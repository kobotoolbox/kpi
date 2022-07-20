# coding: utf-8
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from kpi.filters import SearchFilter
from .base import BaseViewSet
from ..models.transcription import TranscriptionService
from ..serializers import TranscriptionServiceSerializer


class TranscriptionServiceViewSet(BaseViewSet):
    """


    ### CURRENT ENDPOINT
    """

    serializer_class = TranscriptionServiceSerializer
    queryset = TranscriptionService.objects.all()
