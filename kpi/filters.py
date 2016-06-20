from distutils.util import strtobool
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import FieldError
from rest_framework import filters
from haystack.backends.whoosh_backend import WhooshSearchBackend
from whoosh.qparser import QueryParser
from haystack.query import SearchQuerySet
from haystack.inputs import Raw
from haystack.constants import ITERATOR_LOAD_PER_QUERY

from .models.object_permission import get_objects_for_user, get_anonymous_user


class KpiObjectPermissionsFilter(object):
    perm_format = '%(app_label)s.view_%(model_name)s'

    def filter_queryset(self, request, queryset, view):
        user = request.user
        if user.is_superuser and view.action != 'list':
            # For a list, we won't deluge the superuser with everyone else's
            # stuff. This isn't a list, though, so return it all
            return queryset
        # Governs whether unsubscribed (but publicly discoverable) objects are
        # included. Exclude them by default
        all_public = bool(strtobool(
            request.query_params.get('all_public', 'false').lower()))

        model_cls = queryset.model
        kwargs = {
            'app_label': model_cls._meta.app_label,
            'model_name': model_cls._meta.model_name,
        }
        permission = self.perm_format % kwargs

        if user.is_anonymous():
            user = get_anonymous_user()
            # Avoid giving anonymous users special treatment when viewing
            # public objects
            owned_and_explicitly_shared = queryset.none()
        else:
            owned_and_explicitly_shared = get_objects_for_user(
                user, permission, queryset)
        public = get_objects_for_user(
            get_anonymous_user(), permission, queryset)
        if view.action != 'list':
            # Not a list, so discoverability doesn't matter
            return owned_and_explicitly_shared | public

        # For a list, do not include public objects unless they are also
        # discoverable
        try:
            discoverable = public.filter(discoverable_when_public=True)
        except FieldError:
            try:
                # The model does not have a discoverability setting, but maybe
                # its parent does
                discoverable = public.filter(
                    parent__discoverable_when_public=True)
            except FieldError:
                # Neither the model or its parent has a discoverability setting
                discoverable = public.none()

        if all_public:
            # We were asked not to consider subscriptions; return all
            # discoverable objects
            return owned_and_explicitly_shared | discoverable

        # Of the discoverable objects, determine to which the user has
        # subscribed
        try:
            subscribed = public.filter(usercollectionsubscription__user=user)
        except FieldError:
            try:
                # The model does not have a subscription relation, but maybe
                # its parent does
                subscribed = public.filter(
                    parent__usercollectionsubscription__user=user)
            except FieldError:
                # Neither the model or its parent has a subscription relation
                subscribed = public.none()

        return owned_and_explicitly_shared | subscribed


class SearchFilter(filters.BaseFilterBackend):
    ''' Filter objects by searching with Whoosh if the request includes a `q`
    parameter. Another parameter, `parent`, is recognized when its value is an
    empty string; this restricts the queryset to objects without parents. '''
    def filter_queryset(self, request, queryset, view):
        if ('parent' in request.query_params and
                request.query_params['parent'] == ''):
            # Empty string means query for null parent
            queryset = queryset.filter(parent=None)
        if 'q' not in request.query_params:
            return queryset
        queryset_pks = list(queryset.values_list('pk', flat=True))
        if not len(queryset_pks):
            return queryset
        # 'q' means do a full-text search of the document fields, where the
        # critera are given in the Whoosh query language:
        # https://pythonhosted.org/Whoosh/querylang.html
        search_queryset = SearchQuerySet().models(queryset.model)
        search_backend = search_queryset.query.backend
        if not isinstance(search_backend, WhooshSearchBackend):
            raise NotImplementedError(
                'Only the Whoosh search engine is supported at this time')
        if not search_backend.setup_complete:
            search_backend.setup()
        searcher = search_backend.index.searcher()
        query = QueryParser('content', search_backend.index.schema).parse(
            request.query_params['q'])
        results = searcher.search(
            query, scored=False, sortedby=None, limit=None)
        pk_type = type(queryset_pks[0])
        results_pks = {
            # Coerce each `django_id` from unicode to the appropriate type,
            # usually `int`
            pk_type((x['django_id'])) for x in results
        }
        filter_pks = results_pks.intersection(queryset_pks)
        return queryset.filter(pk__in=filter_pks)


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
