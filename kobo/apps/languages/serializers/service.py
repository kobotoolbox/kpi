# coding: utf-8
from rest_framework import serializers

from ..models.transcription import TranscriptionService
from ..models.translation import TranslationService


class BaseServiceSerializer(serializers.ModelSerializer):

    class Meta:
        fields = [
            'code',
            'name',
        ]


class TranscriptionServiceSerializer(BaseServiceSerializer):

    class Meta(BaseServiceSerializer.Meta):
        model = TranscriptionService


class TranslationServiceSerializer(BaseServiceSerializer):

    class Meta(BaseServiceSerializer.Meta):
        model = TranslationService
