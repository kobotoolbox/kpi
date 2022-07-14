# coding: utf-8
from rest_framework import serializers

from .models.language import Language
from .models.transcription import TranscriptionService
from .models.translation import TranslationService


class LanguageServiceSerializer(serializers.ModelSerializer):

    class Meta:
        fields = [
            'code',
            'name',
        ]


class TranslationServiceSeriaLizer(LanguageServiceSerializer):

    class Meta(LanguageServiceSerializer.Meta):
        model = TranslationService


class TranscriptionServiceSerializer(LanguageServiceSerializer):

    class Meta(LanguageServiceSerializer.Meta):
        model = TranscriptionService


class LanguageSerializer(serializers.ModelSerializer):

    transcription_services = TranslationServiceSeriaLizer(many=True)
    translation_services = TranslationServiceSeriaLizer(many=True)

    class Meta:
        model = Language
        fields = (
            'name',
            'code',
            'featured',
            'transcription_services',
            'translation_services',
        )
