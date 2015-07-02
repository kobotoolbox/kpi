from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db.models import Q
from django.core.exceptions import FieldError
from rest_framework.compat import get_model_name
from rest_framework import filters
from haystack.query import SearchQuerySet
from haystack.inputs import AutoQuery
from haystack import connections
import unicodecsv
from io import BytesIO
from .models.object_permission import get_objects_for_user, get_anonymous_user


class KpiObjectPermissionsFilter(object):
    perm_format = '%(app_label)s.view_%(model_name)s'

    def filter_queryset(self, request, queryset, view):
        user = request.user
        model_cls = queryset.model
        kwargs = {
            'app_label': model_cls._meta.app_label,
            'model_name': get_model_name(model_cls)
        }
        permission = self.perm_format % kwargs
        return get_objects_for_user(user, permission, queryset)


class PipeDialect(unicodecsv.Dialect):
    delimiter = '|'
    quotechar = "'"
    escapechar = '\\'
    doublequote = False
    skipinitialspace = False
    # We don't parse multi-line input; furthermore, `lineterminator` is ignored
    # by the reader according to https://docs.python.org/2/library/csv.html
    lineterminator = '\r\n'
    quoting = unicodecsv.QUOTE_ALL


class SearchFilter(filters.BaseFilterBackend):
    '''
    Filters objects by searching with Haystack if the the request includes a
    query.
    '''
    def _apply_query_filter(self, queryset, field, and_values):
        '''
        ?key=this&key=that shall mean this AND that
        ?key=this|that shall mean this OR that

        We use the pipe character with an eye toward eventual Postgres text
        search integration:
        http://www.postgresql.org/docs/9.4/static/functions-textsearch.html
        '''
        for and_value in and_values:
            if and_value is not None and '|' in and_value:
                # "The unicodecsv file reads and decodes byte strings for you,"
                # not unicode strings (http://stackoverflow.com/a/21479663)!
                or_values = unicodecsv.reader(
                    BytesIO(and_value.encode('utf8')),
                    dialect=PipeDialect,
                    encoding='utf-8').next()
                q_query = Q()
                for or_value in or_values:
                    q_query |= Q(**{field: or_value})
                queryset = queryset.filter(q_query)
            else:
                queryset = queryset.filter(**{field: and_value})
        return queryset

    def filter_queryset(self, request, queryset, view):
        is_search = False
        search_queryset = SearchQuerySet().models(queryset.model)
        indexed_fields = connections['default'].get_unified_index().get_index(
            queryset.model).fields
        for k, v in request.query_params.iteritems():
            if k == 'q':
                # 'q' means do a full-text search of the document fields
                search_queryset = search_queryset.filter(content=AutoQuery(v))
                is_search = True
            else:
                # Try doing a regular database query
                v_list = request.query_params.getlist(k)
                if k == 'tag':
                    # 'tag' as shorthand for 'tags__name'
                    k = 'tags__name'
                if k == 'parent' and v == '':
                    # Empty string means query for null parent
                    # TODO: Support null queries generally?
                    v_list = [None]
                try:
                    queryset = self._apply_query_filter(queryset, k, v_list)
                except FieldError:
                    # Invalid field for a database query; try the search engine
                    if k in indexed_fields:
                        search_queryset = search_queryset.filter(
                            **{k: AutoQuery(v)})
                        is_search = True
                    else:
                        # The field is hopelessly invalid.
                        # TODO: Warn the client in some way?
                        pass
        if not is_search:
            return queryset
        # TODO: Call highlight() on the SearchQuerySet and somehow pass the
        # highlighted result to the serializer.
        # http://django-haystack.readthedocs.org/en/latest/searchqueryset_api.html#SearchQuerySet.highlight
        matching_pks = search_queryset.values_list('pk', flat=True)
        # Will still be filtered by KpiObjectPermissionsFilter.filter_queryset()
        return queryset.filter(pk__in=matching_pks)


class KpiAssignedObjectPermissionsFilter(filters.BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        # TODO: omit objects for which the user has only a deny permission
        user = request.user
        if isinstance(request.user, AnonymousUser):
            user = get_anonymous_user()
        if user.is_superuser:
            # Superuser sees all
            return queryset
        if user.pk == settings.ANONYMOUS_USER_ID:
            # Hide permissions for real users from anonymous users
            return queryset.filter(user=user)
        # A regular user sees permissions for objects to which they have access
        content_type_ids = queryset.values_list(
            'content_type', flat=True).distinct()
        object_permission_ids = []
        for content_type_id in content_type_ids:
            object_permission_ids.extend(
                queryset.filter(
                    object_id__in=queryset.filter(
                        content_type_id=content_type_id, user=user
                    ).values_list('object_id', flat=True)
                ).values_list('pk', flat=True)
            )
        return queryset.filter(pk__in=object_permission_ids)
