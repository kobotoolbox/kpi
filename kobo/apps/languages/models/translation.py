# coding: utf-8
from django.contrib import admin
from django.db import models

from .base import (
    BaseLanguageService,
    BaseLanguageServiceAdmin,
    BaseLanguageServiceM2M,
)


class TranslationService(BaseLanguageService):
    pass


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
