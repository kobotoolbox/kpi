# coding: utf-8
from dataclasses import dataclass

from django.contrib import admin
from django.db import models

from .base import (
    BaseLanguageService,
    BaseLanguageServiceAdmin,
    BaseLanguageServiceM2M,
)
from ..exceptions import LanguageNotSupported


@dataclass(frozen=True)
class TranscriptionServiceConfig:
    language_code: str
    location_code: str | None = None
    model_code: str | None = None


class TranscriptionService(BaseLanguageService):

    def get_language_code(self, value: str) -> str:

        try:
            through_obj = TranscriptionServiceLanguageM2M.objects.get(
                service__code=self.code, region__code=value
            )
        except TranscriptionServiceLanguageM2M.DoesNotExist as err:
            # Check if value is itself a language code (e.g. 'en')
            if self.language_set.filter(code=value).exists():
                return value

            # `value` is a region code (e.g. 'fr-BE') not explicitly in
            # the DB. Strip the region suffix to get the parent language code
            # (e.g. 'fr') and check whether that base language is supported.
            # If it is, return the original region code unchanged so that
            # Google STT receives the correct regional hint
            parent_code = value.split('-')[0]
            if parent_code != value and self.language_set.filter(
                code=parent_code
            ).exists():
                return value

            raise LanguageNotSupported from err
        else:
            return (
                through_obj.mapping_code if through_obj.mapping_code else value
            )

    def get_configuration(self, value: str) -> TranscriptionServiceConfig:
        """
        Return the configuration for a given language or region code

        Resolution strategy:
        1. Try to find a configuration matching the region code (e.g. 'en-US').
        2. If not found, check whether the language code (e.g., 'en') is supported.
            - If the language is not supported, raise `LanguageNotSupported`.
        3. If supported, retrieve all configurations for that language:
            - If exactly one configuration exists, return it.
            - If multiple configurations exist, select the most appropriate one
              using a heuristic (e.g., prefer regions ending with the language
              code or '-US').
        4. If no configuration is found, raise a `LanguageNotSupported` exception.
        """
        queryset = TranscriptionServiceLanguageM2M.objects.select_related(
            'region', 'language'
        ).filter(service__code=self.code)

        through_obj = queryset.filter(region__code=value).first()
        if through_obj:
            return self._build_config(through_obj)

        # `value` is a language code (e.g. 'fr') or a region-specific code
        # (e.g. 'fr-BE'). If the exact code is not configured, fall back to the
        # parent language ('fr') and use its stored configuration (model, location,
        # etc.), so region-specific variants inherit their parent language settings
        parent_code = value.split('-')[0]
        lang_code = value if self.language_set.filter(code=value).exists() else (
            parent_code if self.language_set.filter(code=parent_code).exists()
            else None
        )
        if lang_code is None:
            raise LanguageNotSupported

        candidates = list(queryset.filter(language__code=lang_code))
        if len(candidates) == 1:
            return self._build_config(candidates[0])

        if len(candidates) > 1:
            return self._build_config(
                self._get_default_candidate(lang_code, candidates)
            )

        raise LanguageNotSupported

    def _get_default_candidate(
        self,
        language_code: str,
        candidates: list['TranscriptionServiceLanguageM2M'],
    ) -> 'TranscriptionServiceLanguageM2M':
        """
        Return the default configuration for a given language or region code

        Selection priority:
        1. Prefer regions that end with the language code (e.g. 'en-US' for 'en').
        2. If not found, prefer regions that end with '-US' (e.g. 'en-US' for 'en').
        3. If still not found, return the first candidate sorted by region code
        (e.g. 'en-GB' before 'en-AU' for 'en').
        """
        preferred_suffixes = [
            f'-{language_code.upper()}',
            '-US',
        ]

        for suffix in preferred_suffixes:
            candidate = next(
                (
                    item
                    for item in candidates
                    if item.region.code.upper().endswith(suffix)
                ),
                None,
            )
            if candidate:
                return candidate

        return sorted(
            candidates,
            key=lambda candidate: (candidate.region_id, candidate.region.code),
        )[0]

    def _build_config(
        self, through_obj: 'TranscriptionServiceLanguageM2M'
    ) -> TranscriptionServiceConfig:
        return TranscriptionServiceConfig(
            language_code=(
                through_obj.mapping_code
                if through_obj.mapping_code
                else through_obj.region.code
            ),
            location_code=through_obj.location_code,
            model_code=through_obj.model_code,
        )


class TranscriptionServiceAdmin(BaseLanguageServiceAdmin):
    pass


class TranscriptionServiceLanguageM2M(BaseLanguageServiceM2M):

    class Meta:
        unique_together = (('language', 'service', 'region',),)

    service = models.ForeignKey(
        TranscriptionService, related_name='services', on_delete=models.CASCADE
    )
    location_code = models.CharField(max_length=50, blank=True, null=True)
    model_code = models.CharField(max_length=50, blank=True, null=True)


class TranscriptionServiceLanguageM2MInline(admin.TabularInline):

    verbose_name = 'transcription service'
    verbose_name_plural = 'transcription services'
    fields = ('service', 'region', 'mapping_code', 'location_code', 'model_code')

    model = TranscriptionServiceLanguageM2M
    extra = 1
