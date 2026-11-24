# coding: utf-8
from collections import defaultdict

from django.db import models
from rest_framework import serializers

from kobo.apps.subsequences.actions import (
    TRANSCRIPTION_ACTION_IDS_BY_SERVICE_CODE,
)
from ..models.transcription import (
    TranscriptionService,
    TranscriptionServiceLanguageM2M,
)
from .base import (
    BaseServiceLanguageM2MListSerializer,
    BaseServiceLanguageM2MSerializer,
    BaseServiceSerializer,
)


class TranscriptionServiceSerializer(BaseServiceSerializer):

    ACTION_IDS_BY_SERVICE_CODE = TRANSCRIPTION_ACTION_IDS_BY_SERVICE_CODE

    class Meta(BaseServiceSerializer.Meta):
        model = TranscriptionService


class TranscriptionServiceLanguageM2MListSerializer(
    BaseServiceLanguageM2MListSerializer
):

    def _get_formatted_data(self, iterable):
        formatted_data = defaultdict(dict)
        for item in iterable:
            child_repr = self.child.to_representation(item)
            service = child_repr.pop('service')
            formatted_data[service][child_repr.get('region')] = (
                child_repr.get('mapping_code')
                if child_repr.get('mapping_code')
                else child_repr.get('region')
            )
        return formatted_data


class TranscriptionServiceLanguageM2MSerializer(
    BaseServiceLanguageM2MSerializer
):

    class Meta(BaseServiceLanguageM2MSerializer.Meta):
        model = TranscriptionServiceLanguageM2M
        list_serializer_class = TranscriptionServiceLanguageM2MListSerializer
