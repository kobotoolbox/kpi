# coding: utf-8
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework.renderers import JSONRenderer

from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from ..models.transcription import TranscriptionService
from ..serializers import TranscriptionServiceSerializer
from .base import BaseViewSet


@extend_schema(
    tags=['Transcription Services'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('languages', 'transcription/list.md'),
        parameters=[
            OpenApiParameter(
                name='q',
                required=False,
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses=open_api_200_ok_response(
            TranscriptionServiceSerializer,
            raise_access_forbidden=False,
            raise_not_found=False,
            validate_payload=False,
        )
    ),
    retrieve=extend_schema(
        description=read_md('languages', 'transcription/retrieve.md'),
        responses=open_api_200_ok_response(
            TranscriptionServiceSerializer,
            raise_access_forbidden=False,
            validate_payload=False,
        )
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
