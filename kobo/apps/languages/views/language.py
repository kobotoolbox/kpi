# coding: utf-8
from collections import defaultdict

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.renderers import JSONRenderer

from kpi.utils.schema_extensions.markdown import read_md
from ..models.language import Language
from ..serializers import LanguageListSerializer, LanguageSerializer
from .base import BaseViewSet


@extend_schema(
    tags=['Languages'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('languages', 'languages/list.md'),
    ),
    retrieve=extend_schema(
        description=read_md('languages', 'languages/retrieve.md'),
    ),
)
class LanguageViewSet(BaseViewSet):
    """
    Viewset for managing the current (authenticated) user's languages

    Available actions:
    - list          → GET /api/v2/languages/
    - retrieve      → GET /api/v2/languages/{code}/

    Documentation:
    - docs/api/v2/service_usage/list.md
    - docs/api/v2/service_usage/retrieve.md
    """

    serializer_class = LanguageListSerializer
    min_search_characters = 2
    renderer_classes = [
        JSONRenderer,
    ]

    def get_queryset(self):
        if self.action == 'list':
            return Language.objects.all()
        else:
            return Language.objects.prefetch_related('regions')

    def get_serializer_class(self):
        if self.action == 'list':
            return LanguageListSerializer
        else:
            return LanguageSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            # In list view, because of slowness of multiple joins, we only list
            # the available services without any other details such as the
            # supported regions and their mapping codes.

            # We cache service objects to avoid multiple queries within the
            # serializer to retrieve them.
            transcription_services = defaultdict(set)
            queryset = (
                Language.transcription_services.through.objects.select_related(
                    'service'
                )
            )
            for through in queryset.all():
                transcription_services[through.language_id].add(through.service)

            translation_services = defaultdict(set)
            queryset = (
                Language.translation_services.through.objects.select_related(
                    'service'
                )
            )
            for through in queryset.all():
                translation_services[through.language_id].add(through.service)

            context['transcription_services'] = transcription_services
            context['translation_services'] = translation_services

        return context
