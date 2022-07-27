# coding: utf-8
from rest_framework import serializers

from .translation import TranslationServiceLanguageM2MSerializer
from .transcription import TranscriptionServiceLanguageM2MSerializer
from ..models.language import Language, LanguageRegion


class LanguageRegionSerializer(serializers.ModelSerializer):

    class Meta:
        model = LanguageRegion
        fields = [
            'code',
            'name',
        ]


class LanguageSerializer(serializers.ModelSerializer):

    transcription_services = serializers.SerializerMethodField()
    translation_services = serializers.SerializerMethodField()
    regions = LanguageRegionSerializer(many=True)

    class Meta:
        model = Language
        fields = (
            'name',
            'code',
            'featured',
            'transcription_services',
            'translation_services',
            'regions',
        )

    def get_transcription_services(self, language):
        # TODO Optimize. It's very slow because of multiple joins.
        return TranscriptionServiceLanguageM2MSerializer(
            language.transcription_services.through.objects.select_related(
                'language', 'region', 'service'
            ).filter(language=language),
            many=True,
        ).data

    def get_translation_services(self, language):
        # TODO Optimize. It's very slow because of multiple joins.
        return TranslationServiceLanguageM2MSerializer(
            language.translation_services.through.objects.select_related(
                'language', 'region', 'service'
            ).filter(language=language),
            many=True,
        ).data
