# coding: utf-8
from rest_framework import viewsets
from rest_framework import mixins


class NoUpdateModelViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet
):
    """
    Inherit from everything that ModelViewSet does, except for
    UpdateModelMixin.
    """
    pass
