# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from django.core.paginator import InvalidPage
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.pagination import (
    LimitOffsetPagination,
    PageNumberPagination,
    _positive_int
)
from rest_framework.reverse import reverse_lazy
from rest_framework.utils.urls import remove_query_param, replace_query_param


class DataPagination(PageNumberPagination):
    """
    Pagination class for submissions.
    Because DataViewSet doesn't provide a real Django ORM QuerySet and pagination
    is based on `start` and `limit` querystring parameters, some methods of
    PageNumberPagination had to be rewritten to support that case.
    """
    page_size_query_param = 'limit'
    start_query_param = 'start'
    max_page_size = 500

    def get_next_link(self):
        if not self.page.has_next():
            return None
        url = self.request.build_absolute_uri()
        page_number = self.page.next_page_number()
        return replace_query_param(url, self.start_query_param,
                                   (page_number - 1) * self._page_size)

    def get_previous_link(self):
        if not self.page.has_previous():
            return None
        url = self.request.build_absolute_uri()
        page_number = self.page.previous_page_number()
        if page_number == 1:
            return remove_query_param(url, self.start_query_param)
        return replace_query_param(url, self.start_query_param,
                                   (page_number - 1) * self._page_size)

    def get_start_value(self, request):
        try:
            return _positive_int(
                request.query_params[self.start_query_param],
                strict=True
            )
        except (KeyError, ValueError):
            pass

        return 0

    def paginate_queryset(self, data, request, view=None):
        """
        Paginate a queryset if required, either returning a
        page object, or `None` if pagination is not configured for this view.
        """
        page_size = self.get_page_size(request)
        if not page_size:
            return None

        paginator = self.django_paginator_class(data, page_size)
        start = self.get_start_value(request)
        page_number = int(start / page_size) + 1
        self._page_size = page_size

        try:
            self.page = paginator.page(page_number)
        except InvalidPage as exc:
            msg = self.invalid_page_message.format(
                page_number=page_number, message=str(exc)
            )
            raise NotFound(msg)

        if paginator.num_pages > 1 and self.template is not None:
            # The browsable API should display pagination controls.
            self.display_page_controls = True

        self.request = request
        return list(self.page)


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
