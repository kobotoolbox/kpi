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
            # Fall back on language itself and let the service detect the region.
            if self.language_set.filter(code=value).exists():
                return value
            else:
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

        if not self.language_set.filter(code=value).exists():
            raise LanguageNotSupported

        candidates = list(queryset.filter(language__code=value))
        if len(candidates) == 1:
            return self._build_config(candidates[0])

        if len(candidates) > 1:
            return self._build_config(
                self._get_default_candidate(value, candidates)
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
