# coding: utf-8
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.renderers import JSONRenderer

from ..models.transcription import TranscriptionService
from ..serializers import TranscriptionServiceSerializer
from .base import BaseViewSet


@extend_schema(
    tags=['Transcription Services'],
)
@extend_schema_view(
    list=extend_schema(
        description='list',
    ),
    retrieve=extend_schema(
        description='retrieve',
    ),
)
class TranscriptionServiceViewSet(BaseViewSet):
    """
    Viewset for transcription services

    Available actions:
    - list           → GET       /api/v2/transcription-services/
    - retrieve       → GET       /api/v2/transcription-services/{code}/
    
    Documentation:
    - docs/api/v2/transcription/list.md
    - docs/api/v2/transcription/retrieve.md
    """

    serializer_class = TranscriptionServiceSerializer
    queryset = TranscriptionService.objects.all()
    renderer_classes = [
        JSONRenderer,
    ]
