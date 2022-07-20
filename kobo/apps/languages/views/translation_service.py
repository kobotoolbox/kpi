# coding: utf-8
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kpi.filters import SearchFilter
from .base import BaseViewSet
from ..models.translation import TranslationService
from ..serializers import TranslationServiceSerializer


class TranslationServiceViewSet(BaseViewSet):
    """


    ### CURRENT ENDPOINT
    """

    serializer_class = TranslationServiceSerializer
    queryset = TranslationService.objects.all()
