# coding: utf-8
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from rest_framework.renderers import JSONRenderer

from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response
from ..models.translation import TranslationService
from ..serializers import TranslationServiceSerializer
from .base import BaseViewSet


@extend_schema(
    tags=['Translation Services'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('languages', 'translation/list.md'),
        parameters=[
            OpenApiParameter(
                name='q',
                required=False,
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
            ),
        ],
        responses=open_api_200_ok_response(
            TranslationServiceSerializer,
            raise_not_found=False,
            raise_access_forbidden=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('languages', 'translation/retrieve.md'),
        responses=open_api_200_ok_response(
            TranslationServiceSerializer,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class TranslationServiceViewSet(BaseViewSet):
    """
    Viewset for translation services

    Available actions:
    - list           → GET       /api/v2/translation-services/
    - retrieve       → GET       /api/v2/translation-services/{code}/

    Documentation:
    - docs/api/v2/translation/list.md
    - docs/api/v2/translation/retrieve.md
    """

    serializer_class = TranslationServiceSerializer
    queryset = TranslationService.objects.all()
    renderer_classes = [
        JSONRenderer,
    ]
