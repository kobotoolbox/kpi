# coding: utf-8
from collections import defaultdict

from django.db import models
from rest_framework import serializers

from kobo.apps.subsequences.actions import (
    TRANSLATION_ACTION_IDS_BY_SERVICE_CODE,
)
from ..models.translation import (
    TranslationService,
    TranslationServiceLanguageM2M,
)
from .base import (
    BaseServiceLanguageM2MListSerializer,
    BaseServiceLanguageM2MSerializer,
    BaseServiceSerializer,
)


class TranslationServiceSerializer(BaseServiceSerializer):

    ACTION_IDS_BY_SERVICE_CODE = TRANSLATION_ACTION_IDS_BY_SERVICE_CODE

    class Meta(BaseServiceSerializer.Meta):
        model = TranslationService


class TranslationServiceLanguageM2MListSerializer(
    BaseServiceLanguageM2MListSerializer
):

    def _get_formatted_data(self, iterable):
        formatted_data = defaultdict(dict)
        for item in iterable:
            child_repr = self.child.to_representation(item)
            service = child_repr.pop('service')
            key = child_repr.get('region') or child_repr['language']
            formatted_data[service][key] = (
                child_repr.get('mapping_code')
                if child_repr.get('mapping_code')
                else key
            )
        return formatted_data


class TranslationServiceLanguageM2MSerializer(
    BaseServiceLanguageM2MSerializer
):

    class Meta(BaseServiceLanguageM2MSerializer.Meta):
        model = TranslationServiceLanguageM2M
        list_serializer_class = TranslationServiceLanguageM2MListSerializer
