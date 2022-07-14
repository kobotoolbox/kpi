# coding: utf-8
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kpi.filters import SearchFilter
from .models.language import Language
from .serializers import LanguageSerializer


class LanguageViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = LanguageSerializer
    permission_classes = (IsAuthenticated,)
    lookup_field = 'code'
    filter_backends = [SearchFilter]
    search_default_field_lookups = [
        'name__icontains',
        'code__icontains'
    ]
    min_search_characters = 2
    queryset = Language.objects.all()
