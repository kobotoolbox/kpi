# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from django.contrib.auth.models import User
from rest_framework import viewsets
from kpi.serializers import CurrentUserSerializer


class CurrentUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.none()
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user
