# coding: utf-8
from rest_framework import serializers

from .service import (
    TranscriptionServiceSerializer,
    TranslationServiceSerializer,
)
from ..models.language import Language


class LanguageSerializer(serializers.ModelSerializer):

    transcription_services = TranslationServiceSerializer(many=True)
    translation_services = TranslationServiceSerializer(many=True)

    class Meta:
        model = Language
        fields = (
            'name',
            'code',
            'featured',
            'transcription_services',
            'translation_services',
        )
