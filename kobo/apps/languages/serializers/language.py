# coding: utf-8
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .translation import TranslationServiceSerializer, TranslationServiceLanguageM2MSerializer
from .transcription import TranscriptionServiceSerializer, TranscriptionServiceLanguageM2MSerializer
from ..schema_extensions.v2.languages.fields import ServicesField, LanguageUrlField
from ..models.language import Language, LanguageRegion


@extend_schema_field(LanguageUrlField)
class LanguageUrlOverload(serializers.HyperlinkedIdentityField):
    pass

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

    @extend_schema_field(ServicesField)
    def get_transcription_services(self, language):
        return TranscriptionServiceLanguageM2MSerializer(
            language.transcription_services.through.objects.select_related(
                'language', 'region', 'service'
            ).filter(language=language),
            many=True,
        ).data

    @extend_schema_field(ServicesField)
    def get_translation_services(self, language):
        return TranslationServiceLanguageM2MSerializer(
            language.translation_services.through.objects.select_related(
                'language', 'region', 'service'
            ).filter(language=language),
            many=True,
        ).data


class LanguageListSerializer(LanguageSerializer):

    url = LanguageUrlOverload(
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

    @extend_schema_field(ServicesField)
    def get_transcription_services(self, language):
        transcription_services = self.context['transcription_services']
        return TranscriptionServiceSerializer(
            transcription_services.get(language.pk, []), many=True
        ).data

    @extend_schema_field(ServicesField)
    def get_translation_services(self, language):
        translation_services = self.context['translation_services']
        return TranslationServiceSerializer(
            translation_services.get(language.pk, []), many=True
        ).data
