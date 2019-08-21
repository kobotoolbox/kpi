# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

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
