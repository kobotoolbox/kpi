# coding: utf-8
from django.contrib import admin
from django.db import models

from .base import (
    BaseLanguageService,
    BaseLanguageServiceAdmin,
    BaseLanguageServiceM2M,
)


class TranscriptionService(BaseLanguageService):
    pass


class TranscriptionServiceAdmin(BaseLanguageServiceAdmin):
    pass


class TranscriptionServiceLanguageM2M(BaseLanguageServiceM2M):

    class Meta:
        unique_together = (('language', 'service', 'region',),)

    service = models.ForeignKey(
        TranscriptionService, related_name='services', on_delete=models.CASCADE
    )


class TranscriptionServiceLanguageM2MInline(admin.TabularInline):

    verbose_name = 'transcription service'
    verbose_name_plural = 'transcription services'
    fields = ('service', 'region', 'mapping_code',)

    model = TranscriptionServiceLanguageM2M
    extra = 1
