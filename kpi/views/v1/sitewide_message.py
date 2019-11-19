# coding: utf-8
from rest_framework import viewsets

from hub.models import SitewideMessage
from kpi.serializers import SitewideMessageSerializer


class SitewideMessageViewSet(viewsets.ModelViewSet):
    queryset = SitewideMessage.objects.all()
    serializer_class = SitewideMessageSerializer
