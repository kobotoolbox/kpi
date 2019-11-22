# coding: utf-8
from django.conf import settings
from rest_framework.pagination import (
    LimitOffsetPagination,
    PageNumberPagination,
)
from rest_framework.reverse import reverse_lazy
from rest_framework.serializers import SerializerMethodField


class DataPagination(LimitOffsetPagination):
    """
    Pagination class for submissions.
    """
    default_limit = settings.SUBMISSION_LIST_LIMIT
    offset_query_param = 'start'
    max_limit = settings.SUBMISSION_LIST_LIMIT


class Paginated(LimitOffsetPagination):
    """ Adds 'root' to the wrapping response object. """
    root = SerializerMethodField('get_parent_url', read_only=True)

    def get_parent_url(self, obj):
        return reverse_lazy('api-root', request=self.context.get('request'))


class TinyPaginated(PageNumberPagination):
    """
    Same as Paginated with a small page size
    """
    page_size = 50
