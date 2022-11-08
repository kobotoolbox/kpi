# coding: utf-8
from django.contrib import admin
from django.db import models
from django.db.models import Q

from .base import (
    BaseLanguageService,
    BaseLanguageServiceAdmin,
    BaseLanguageServiceM2M,
)
from ..exceptions import LanguageNotSupported


class TranslationService(BaseLanguageService):

    def get_language_code(self, value: str) -> str:

        try:
            through_obj = TranslationServiceLanguageM2M.objects.get(
                Q(region__code=value) |
                Q(language__code=value, region__isnull=True),
                service__code=self.code,
            )
        except TranslationServiceLanguageM2M.DoesNotExist:
            raise LanguageNotSupported
        else:
            return (
                through_obj.mapping_code if through_obj.mapping_code else value
            )


class TranslationServiceAdmin(BaseLanguageServiceAdmin):
    pass


class TranslationServiceLanguageM2M(BaseLanguageServiceM2M):

    service = models.ForeignKey(
        TranslationService, related_name='services', on_delete=models.CASCADE
    )
    # Most of translation services only use the language code. We want the
    # structure to be future-proof and support other translation services which
    # do provide translations for regional languages (e.g.: fr-CA).
    region = models.ForeignKey(
        'LanguageRegion',
        related_name='regions',
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )


class TranslationServiceLanguageM2MInline(admin.TabularInline):

    verbose_name = 'translation service'
    verbose_name_plural = 'translation services'
    fields = ('service', 'region', 'mapping_code')

    model = TranslationServiceLanguageM2M
    extra = 1
