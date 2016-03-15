from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework import filters
from haystack.query import SearchQuerySet
from haystack.inputs import Raw
from haystack.constants import ITERATOR_LOAD_PER_QUERY

from .models.object_permission import get_objects_for_user, get_anonymous_user


class KpiObjectPermissionsFilter(object):
    perm_format = '%(app_label)s.view_%(model_name)s'

    def filter_queryset(self, request, queryset, view):
        user = request.user
        model_cls = queryset.model
        kwargs = {
            'app_label': model_cls._meta.app_label,
            'model_name': model_cls._meta.model_name,
        }
        permission = self.perm_format % kwargs

        strict_query= view.action == 'list'
        return get_objects_for_user(user, permission, queryset, strict=strict_query)


class SearchFilter(filters.BaseFilterBackend):
    '''
    Filters objects by searching with Haystack if the the request includes a
    query.
    '''
    def filter_queryset(self, request, queryset, view):
        is_search = False
        search_queryset = SearchQuerySet().models(queryset.model)
        for k, v in request.query_params.iteritems():
            if k == 'q':
                # 'q' means do a full-text search of the document fields.
                # Raw() passes the search string unaltered to Woosh. This loses
                # backend agnosticism but gains a rich query language:
                # https://pythonhosted.org/Whoosh/querylang.html
                search_queryset = search_queryset.filter(content=Raw(v))
                is_search = True
            elif k == 'parent' and v == '':
                # Empty string means query for null parent
                queryset = queryset.filter(parent=None)
        if not is_search:
            return queryset
        # TODO: Call highlight() on the SearchQuerySet and somehow pass the
        # highlighted result to the serializer.
        # http://django-haystack.readthedocs.org/en/latest/searchqueryset_api.html#SearchQuerySet.highlight
        matching_pks = search_queryset.values_list('pk', flat=True)
        # We can now read len(matching_pks) very quickly, so the search engine
        # has done its job. HOWEVER, Haystack will only retrieve the actual pks
        # in batches of 10 (HAYSTACK_ITERATOR_LOAD_PER_QUERY), with each batch
        # taking nearly a tenth of a second! By using a slice, we can force
        # Haystack to hand over all the pks at once.
        big_slice = max(ITERATOR_LOAD_PER_QUERY, search_queryset.count())
        matching_pks = list(matching_pks[:big_slice])
        # Will still be filtered by KpiObjectPermissionsFilter.filter_queryset()
        # TODO: Preserve ordering of search results
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
