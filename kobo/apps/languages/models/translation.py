# coding: utf-8
from django.contrib import admin
from django.db import models

from . import (
    BaseLanguageService,
    BaseLanguageServiceAdmin,
    BaseLanguageServiceM2M,
)


class TranslationService(BaseLanguageService):
    pass


class TranslationServiceAdmin(BaseLanguageServiceAdmin):
    pass


class TranslationServiceLanguageM2M(BaseLanguageServiceM2M):
    service = models.ForeignKey(TranslationService, on_delete=models.CASCADE)


class TranslationServiceLanguageM2MInline(admin.TabularInline):

    verbose_name = 'translation service'
    verbose_name_plural = 'translation services'
    fields = ('service', 'code',)

    model = TranslationServiceLanguageM2M
    extra = 1
