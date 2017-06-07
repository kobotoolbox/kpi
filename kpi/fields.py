from collections import OrderedDict

from django.db import models
from rest_framework.serializers import ReadOnlyField
from rest_framework.pagination import LimitOffsetPagination
from shortuuid import ShortUUID

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


class PaginatedApiField(ReadOnlyField):
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
