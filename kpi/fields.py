import copy
from collections import OrderedDict

from django.db import models
from django.core.exceptions import FieldError

from shortuuid import ShortUUID
from rest_framework import serializers
from rest_framework.reverse import reverse
from jsonbfield.fields import JSONField as JSONBField
from rest_framework.pagination import LimitOffsetPagination

# should be 22 per shortuuid documentation, but keeping at 21 to avoid having
# to migrate dkobo (see SurveyDraft.kpi_asset_uid)
UUID_LENGTH = 21


class KpiUidField(models.CharField):
    ''' If empty, automatically populates itself with a UID before saving '''
    def __init__(self, uid_prefix):
        self.uid_prefix = uid_prefix
        total_length = len(uid_prefix) + UUID_LENGTH
        super(KpiUidField, self).__init__(max_length=total_length, unique=True)

    def deconstruct(self):
        name, path, args, kwargs = super(KpiUidField, self).deconstruct()
        kwargs['uid_prefix'] = self.uid_prefix
        del kwargs['max_length']
        del kwargs['unique']
        return name, path, args, kwargs

    def generate_uid(self):
        return self.uid_prefix + ShortUUID().random(UUID_LENGTH)
        # When UID_LENGTH is 22, that should be changed to:
        # return self.uid_prefix + shortuuid.uuid()

    def pre_save(self, model_instance, add):
        value = getattr(model_instance, self.attname)
        if value == '':
            value = self.generate_uid()
            setattr(model_instance, self.attname, value)
        return value


class LazyDefaultJSONBField(JSONBField):
    '''
    Allows specifying a default value for a new field without having to rewrite
    every row in the corresponding table when migrating the database.

    Whenever the database contains a null:
        1. The field will present the default value instead of None;
        2. The field will overwrite the null with the default value if the
           instance it belongs to is saved.
    '''
    def __init__(self, *args, **kwargs):
        if kwargs.get('null', False):
            raise FieldError('Do not manually specify null=True for a '
                             'LazyDefaultJSONBField')
        self.lazy_default = kwargs.get('default')
        if self.lazy_default is None:
            raise FieldError('LazyDefaultJSONBField requires a default that '
                             'is not None')
        kwargs['null'] = True
        kwargs['default'] = None
        super(LazyDefaultJSONBField, self).__init__(*args, **kwargs)

    def _get_lazy_default(self):
        if callable(self.lazy_default):
            return self.lazy_default()
        else:
            return self.lazy_default

    def deconstruct(self):
        name, path, args, kwargs = super(
            LazyDefaultJSONBField, self).deconstruct()
        kwargs['default'] = self.lazy_default
        del kwargs['null']
        return name, path, args, kwargs

    def from_db_value(self, value, *args, **kwargs):
        if value is None:
            return self._get_lazy_default()
        return value

    def pre_save(self, model_instance, add):
        value = getattr(model_instance, self.attname)
        if value is None:
            setattr(model_instance, self.attname, self._get_lazy_default())
        return value


class PaginatedApiField(serializers.ReadOnlyField):
    '''
    Serializes a manager or queryset `source` to a paginated representation
    '''
    def __init__(self, serializer_class, *args, **kwargs):
        r'''
        The `source`, whether implied or explicit, must be a manager or
        queryset. Alternatively, pass a `source_processor` callable that
        transforms `source` into a usable queryset.

        :param serializer_class: The class (not instance) of the desired list
            serializer. Required.
        :param paginator_class: Optional; defaults to `LimitOffsetPagination`.
        :param default_limit: Optional; defaults to `10`.
        :param source_processor: Optional; a callable that receives `source`
            and must return an usable queryset
        '''
        self.serializer_class = serializer_class
        self.paginator = kwargs.pop('paginator_class', LimitOffsetPagination)()
        self.paginator.default_limit = kwargs.pop('default_limit', 10)
        self.source_processor = kwargs.pop('source_processor', None)
        return super(PaginatedApiField, self).__init__(*args, **kwargs)

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
        serializer = self.serializer_class(
            page, many=True, context=self.context)
        return OrderedDict([
            ('count', self.paginator.count),
            ('next', self.paginator.get_next_link()),
            ('previous', self.paginator.get_previous_link()),
            ('results', serializer.data)
        ])


class SerializerMethodFileField(serializers.FileField):
    '''
    A `FileField` that gets its representation from calling a method on the
    parent serializer class, like a `SerializerMethodField`. The method called
    will be of the form "get_{field_name}", and should take a single argument,
    which is the object being serialized.
    '''
    def __init__(self, *args, **kwargs):
        self._serializer_method_field = serializers.SerializerMethodField()
        super(SerializerMethodFileField, self).__init__(*args, **kwargs)

    def bind(self, *args, **kwargs):
        self._serializer_method_field.bind(*args, **kwargs)
        super(SerializerMethodFileField, self).bind(*args, **kwargs)

    def to_representation(self, obj):
        return self._serializer_method_field.to_representation(obj.instance)
