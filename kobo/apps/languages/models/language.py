# coding: utf-8
from django.contrib import admin
from django.db import models

from .transcription import TranscriptionServiceLanguageM2MInline
from .translation import TranslationServiceLanguageM2MInline


class Language(models.Model):

    class Meta:
        verbose_name = 'language'
        ordering = ['-featured', 'name']

    def __str__(self):
        return f'{self.name} ({self.code})'

    # Full name of the language (e.g.: English)
    name = models.CharField(max_length=200)
    # Short language code (e.g.: en)
    code = models.CharField(max_length=10)
    # Short display first when equals `True`
    featured = models.BooleanField(default=False)
    transcription_services = models.ManyToManyField(
        'TranscriptionService',
        through='TranscriptionServiceLanguageM2M',
    )
    translation_services = models.ManyToManyField(
        'TranslationService',
        through='TranslationServiceLanguageM2M',
    )


class LanguageAdmin(admin.ModelAdmin):
    inlines = [
        TranslationServiceLanguageM2MInline,
        TranscriptionServiceLanguageM2MInline,
    ]

    list_display = ['name', 'code', 'featured']
