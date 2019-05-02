# -*- coding: utf-8 -*-
from rest_framework import serializers, exceptions
from rest_framework.pagination import LimitOffsetPagination, PageNumberPagination
from rest_framework.reverse import reverse_lazy


class Paginated(LimitOffsetPagination):

    """ Adds 'root' to the wrapping response object. """
    root = serializers.SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        return reverse_lazy('api-root', request=self.context.get('request'))


class TinyPaginated(PageNumberPagination):
    """
    Same as Paginated with a small page size
    """
    page_size = 50
