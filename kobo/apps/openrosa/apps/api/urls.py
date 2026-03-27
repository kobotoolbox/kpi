# coding: utf-8
from django.urls import re_path
from django.urls.exceptions import NoReverseMatch
from rest_framework import routers
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework.urlpatterns import format_suffix_patterns

from kobo.apps.openrosa.apps.api.viewsets.briefcase_api import BriefcaseApi
from kpi.models.asset import Asset
from .utils.rest_framework.views import OpenRosaAPIView


class MultiLookupRouter(routers.DefaultRouter):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.lookups_routes = []
        self.lookups_routes.append(routers.Route(
            url=r'^{prefix}/{lookups}{trailing_slash}$',
            mapping={
                'get': 'retrieve',
                'put': 'update',
                'patch': 'partial_update',
                'delete': 'destroy'
            },
            name='{basename}-detail',
            detail=True,
            initkwargs={'suffix': 'Instance'}
        ))
        self.lookups_routes.append(self.make_routes('lookup'))
        self.lookups_routes.append(self.make_routes('lookups'))
        # Dynamically generated routes.
        # Generated using @action or @link decorators on methods of the viewset

        self.lookups_routes.append(routers.Route(
            url=[
                r'^{prefix}/{lookups}/{methodname}{trailing_slash}$',
                r'^{prefix}/{lookups}/{methodname}/{extra}{trailing_slash}$'],
            mapping={
                '{httpmethod}': '{methodname}',
            },
            name='{basename}-{methodnamehyphen}',
            detail=True,
            initkwargs={}
        ))

    @staticmethod
    def make_routes(template_text):
        return routers.Route(
            url=r'^{prefix}/{%s}{trailing_slash}$' % template_text,
            mapping={
                'get': 'list',
                'post': 'create'
            },
            name='{basename}-list',
            detail=False,
            initkwargs={'suffix': 'List'})

    def get_extra_lookup_regexes(self, route):
        ret = []
        base_regex = '(?P<{lookup_field}>[^/]+)'
        if 'extra_lookup_fields' in route.initkwargs:
            for lookup_field in route.initkwargs['extra_lookup_fields']:
                ret.append(base_regex.format(lookup_field=lookup_field))
        return '/'.join(ret)

    def get_lookup_regexes(self, viewset):
        ret = []
        lookup_fields = getattr(viewset, 'lookup_fields', None)
        if lookup_fields:
            for i in range(1, len(lookup_fields)):
                tmp = []
                for lookup_field in lookup_fields[:i + 1]:
                    if lookup_field == lookup_fields[i]:
                        base_regex = '(?P<{lookup_field}>[^/.]+)'
                    else:
                        base_regex = '(?P<{lookup_field}>[^/]+)'
                    tmp.append(base_regex.format(lookup_field=lookup_field))
                ret.append(tmp)
        return ret

    def get_lookup_routes(self, viewset):
        ret = [self.routes[0]]
        for route in self.lookups_routes:
            if route.mapping == {'{httpmethod}': '{methodname}'}:
                for extra_action in viewset.get_extra_actions():
                    methodname = extra_action.__name__
                    mapping = extra_action.mapping
                    detail = extra_action.detail
                    initkwargs = route.initkwargs.copy()
                    initkwargs.update(extra_action.kwargs)
                    name = self.replace_methodname(route.name, methodname)
                    if 'extra_lookup_fields' in initkwargs:
                        uri = route.url[1]
                        uri = self.replace_methodname(uri, methodname)
                        ret.append(routers.Route(
                            url=uri,
                            mapping=mapping,
                            name=f'{name}-extra',
                            initkwargs=initkwargs,
                            detail=detail
                        ))

                    uri = self.replace_methodname(route.url[0], methodname)
                    ret.append(routers.Route(
                        url=uri,
                        mapping=mapping,
                        name=name,
                        initkwargs=initkwargs,
                        detail=detail
                    ))
            else:
                # Standard route
                ret.append(route)
        return ret

    def get_routes(self, viewset):
        ret = []
        lookup_fields = getattr(viewset, 'lookup_fields', None)
        if lookup_fields:
            ret = self.get_lookup_routes(viewset)
        else:
            ret = super().get_routes(viewset)
        return ret

    def get_api_root_view(self):
        """
        Return a view to use as the API root.
        """
        api_root_dict = {}
        list_name = self.routes[0].name
        for prefix, viewset, basename in self.registry:
            api_root_dict[prefix] = list_name.format(basename=basename)

        class KoboAPIV1(OpenRosaAPIView):
            """
            ## Kobo JSON Rest API endpoints:

            ## Status Codes

            * **200** - Successful [`GET`, `PATCH`, `PUT`]
            * **201** - Resource successfully created [`POST`]
            * **204** - Resouce successfully deleted [`DELETE`]
            * **403** - Permission denied to resource
            * **404** - Resource was not found

            ## Authentication

            Kobo JSON API endpoints support both Basic authentication
            and API Token Authentication through the `Authorization` header.

            ### Basic Authentication

            Example using curl:

                curl -X GET https://example.com/api/v1/ -u username:password

            ### Token Authentication

            Example using curl:

                curl -X GET https://example.com/api/v1/ -H "Authorization: Token TOKEN_KEY"

            """
            _ignore_model_permissions = True

            class Meta:
                model = Asset
                fields = '__all__'

            def get(self, request, format=None):
                ret = {}
                for key, url_name in api_root_dict.items():
                    try:
                        ret[key] = reverse(
                            url_name, request=request, format=format
                        )
                    except NoReverseMatch:
                        # Can happen if list endpoint does not exist but
                        # detail does. E.g. `/api/v1/users/` is not registered
                        # but `/api/v1/users/<username>` is.
                        continue
                return Response(ret)

        return KoboAPIV1.as_view()

    def get_urls(self):
        ret = []

        if self.include_root_view:
            root_url = re_path(r'^$', self.get_api_root_view(),
                               name=self.root_view_name)
            ret.append(root_url)
        for prefix, viewset, basename in self.registry:
            lookup = self.get_lookup_regex(viewset)
            lookup_list = self.get_lookup_regexes(viewset)
            if lookup_list:
                # lookup = lookups[0]
                lookup_list = ['/'.join(k) for k in lookup_list]
            else:
                lookup_list = ['']
            routes = self.get_routes(viewset)
            for route in routes:
                mapping = self.get_method_map(viewset, route.mapping)
                if not mapping:
                    continue
                for lookups in lookup_list:
                    regex = route.url.format(
                        prefix=prefix,
                        lookup=lookup,
                        lookups=lookups,
                        trailing_slash=self.trailing_slash,
                        extra=self.get_extra_lookup_regexes(route)
                    )
                    view = viewset.as_view(mapping, **route.initkwargs)
                    name = route.name.format(basename=basename)
                    ret.append(re_path(regex, view, name=name))
        if self.include_format_suffixes:
            ret = format_suffix_patterns(ret, allowed=['[a-z0-9]+'])
        return ret

    @staticmethod
    def replace_methodname(format_string, methodname):
        """
        Taken from old version of DRF for retro-compatibility.
        (AFAIK, this method has been dropped in DRF 3.8)

        Partially format a format_string, swapping out any
        '{methodname}' or '{methodnamehyphen}' components.

        @ToDo If DRF got rid of it, we should too? Let's find a better way to
        achieve the same goal.
        """
        methodnamehyphen = methodname.replace('_', '-')
        ret = format_string
        ret = ret.replace('{methodname}', methodname)
        ret = ret.replace('{methodnamehyphen}', methodnamehyphen)
        return ret


class MultiLookupRouterWithPatchList(MultiLookupRouter):
    """
    This class only extends MultiLookupRouter to allow PATCH method on list endpoint
    """
    @staticmethod
    def make_routes(template_text):
        return routers.Route(
            url=r'^{prefix}/{%s}{trailing_slash}$' % template_text,
            mapping={
                'get': 'list',
                'post': 'create',
                'patch': 'bulk_validation_status',
                'delete': 'bulk_delete'
            },
            name='{basename}-list',
            detail=False,
            initkwargs={'suffix': 'List'})


router = MultiLookupRouter(trailing_slash=False)

router.register(r'briefcase', BriefcaseApi, basename='briefcase')

router_with_patch_list = MultiLookupRouterWithPatchList(trailing_slash=False)
