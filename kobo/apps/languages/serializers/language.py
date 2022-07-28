# coding: utf-8
from rest_framework import serializers

from .translation import TranslationServiceSerializer, TranslationServiceLanguageM2MSerializer
from .transcription import TranscriptionServiceSerializer, TranscriptionServiceLanguageM2MSerializer
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
        return TranscriptionServiceLanguageM2MSerializer(
            language.transcription_services.through.objects.select_related(
                'language', 'region', 'service'
            ).filter(language=language),
            many=True,
        ).data

    def get_translation_services(self, language):
        return TranslationServiceLanguageM2MSerializer(
            language.translation_services.through.objects.select_related(
                'language', 'region', 'service'
            ).filter(language=language),
            many=True,
        ).data


class LanguageListSerializer(LanguageSerializer):

    url = serializers.HyperlinkedIdentityField(
        view_name='language-detail', lookup_field='code'
    )
    regions = None

    class Meta(LanguageSerializer.Meta):
        fields = fields = (
            'name',
            'code',
            'featured',
            'transcription_services',
            'translation_services',
            'url',
        )

    def get_transcription_services(self, language):
        transcription_services = self.context['transcription_services']
        return TranscriptionServiceSerializer(
            transcription_services.get(language.pk, []), many=True
        ).data

    def get_translation_services(self, language):
        translation_services = self.context['translation_services']
        return TranslationServiceSerializer(
            translation_services.get(language.pk, []), many=True
        ).data
