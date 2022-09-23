# coding: utf-8
from django.contrib import admin
from django.db import models

from .base import (
    BaseLanguageService,
    BaseLanguageServiceAdmin,
    BaseLanguageServiceM2M,
)
from ..exceptions import LanguageNotSupported


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
