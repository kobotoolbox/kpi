# coding: utf-8
from collections import OrderedDict

from django.utils.module_loading import import_string
from rest_framework import serializers
from rest_framework.pagination import LimitOffsetPagination


class PaginatedApiField(serializers.ReadOnlyField):
    """
    Serializes a manager or queryset `source` to a paginated representation
    """
    def __init__(self, serializer_class, *args, **kwargs):
        """
        The `source`, whether implied or explicit, must be a manager or
        queryset. Alternatively, pass a `source_processor` callable that
        transforms `source` into a usable queryset.

        :param serializer_class: The class (not instance) of the desired list
            serializer. Required.
        :param paginator_class: Optional; defaults to `LimitOffsetPagination`.
        :param default_limit: Optional; defaults to `10`.
        :param source_processor: Optional; a callable that receives `source`
            and must return an usable queryset
        """
        self.serializer_class = serializer_class
        self.paginator = kwargs.pop('paginator_class', LimitOffsetPagination)()
        self.paginator.default_limit = kwargs.pop('default_limit', 10)
        self.source_processor = kwargs.pop('source_processor', None)
        super().__init__(*args, **kwargs)

    def to_representation(self, source):
        if self.source_processor:
            queryset = self.source_processor(source)
        else:
            queryset = source.all()
        # FIXME: The paginator makes `next` and `previous` URLs that don't
        # include the name of the field, e.g. paginating the `assets` field in
        # `UserSerializer` results in
        # `http://host/users/person/?limit=10&offset=10`. This won't allow for
        # pagination of more than one field per object
        page = self.paginator.paginate_queryset(
            queryset=queryset,
            request=self.context.get('request', None)
        )
        if isinstance(self.serializer_class, str):
            serializer_class = import_string(self.serializer_class)
        else:
            serializer_class = self.serializer_class
        serializer = serializer_class(page, many=True, context=self.context)
        return OrderedDict([
            ('count', self.paginator.count),
            ('next', self.paginator.get_next_link()),
            ('previous', self.paginator.get_previous_link()),
            ('results', serializer.data)
        ])
