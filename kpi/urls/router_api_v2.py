# coding: utf-8
from django.urls import re_path
from rest_framework_extensions.routers import ExtendedDefaultRouter

from kobo.apps.hook.views.v2.hook import HookViewSet
from kobo.apps.hook.views.v2.hook_log import HookLogViewSet
from kobo.apps.hook.views.v2.hook_signal import HookSignalViewSet
from kpi.views.v2.asset import AssetViewSet
from kpi.views.v2.asset_export_settings import AssetExportSettingsViewSet
from kpi.views.v2.asset_file import AssetFileViewSet
from kpi.views.v2.asset_permission_assignment import AssetPermissionAssignmentViewSet
from kpi.views.v2.asset_snapshot import AssetSnapshotViewSet
from kpi.views.v2.asset_version import AssetVersionViewSet
from kpi.views.v2.attachment import AttachmentViewSet
from kpi.views.v2.data import DataViewSet
from kpi.views.v2.export_task import ExportTaskViewSet
from kpi.views.v2.import_task import ImportTaskViewSet
from kpi.views.v2.paired_data import PairedDataViewset
from kpi.views.v2.permission import PermissionViewSet
from kpi.views.v2.user import UserViewSet
from kpi.views.v2.user_asset_subscription import UserAssetSubscriptionViewSet


class OptionalSlashRouter(ExtendedDefaultRouter):
    """
    Add support to OpenRosa endpoints which should not end with a trailing slash.

    `ExtendedDefaultRouter` redirects routes without trailing slash to their
    counterparts with a trailing slash. This behaviour should be avoided with
    OpenRosa endpoints because clients POST requests will be redirected losing
    their payload.
    """

    def get_urls(self):
        """
        Use the registered viewsets to generate a list of URL patterns.
        """
        ret = []

        for prefix, viewset, basename in self.registry:
            lookup = self.get_lookup_regex(viewset)
            routes = self.get_routes(viewset)

            for route in routes:

                # Only actions which actually exist on the viewset will be bound
                mapping = self.get_method_map(viewset, route.mapping)
                if not mapping:
                    continue

                try:
                    trailing_slash = route.initkwargs['trailing_slash']
                except KeyError:
                    trailing_slash = self.trailing_slash

                # Build the url pattern
                regex = route.url.format(
                    prefix=prefix,
                    lookup=lookup,
                    trailing_slash=trailing_slash
                )

                # If there is no prefix, the first part of the url is probably
                #   controlled by project's urls.py and the router is in an app,
                #   so a slash in the beginning will (A) cause Django to give
                #   warnings and (B) generate URLS that will require using '//'.
                if not prefix and regex[:2] == '^/':
                    regex = '^' + regex[2:]

                initkwargs = route.initkwargs.copy()
                initkwargs.update({
                    'basename': basename,
                    'detail': route.detail,
                })

                view = viewset.as_view(mapping, **initkwargs)
                name = route.name.format(basename=basename)
                ret.append(re_path(regex, view, name=name))

        return ret


URL_NAMESPACE = 'api_v2'

router_api_v2 = OptionalSlashRouter()
asset_routes = router_api_v2.register(r'assets', AssetViewSet, basename='asset')

asset_routes.register(r'files',
                      AssetFileViewSet,
                      basename='asset-file',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'permission-assignments',
                      AssetPermissionAssignmentViewSet,
                      basename='asset-permission-assignment',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'versions',
                      AssetVersionViewSet,
                      basename='asset-version',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'export-settings',
                      AssetExportSettingsViewSet,
                      basename='asset-export-settings',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'exports',
                      ExportTaskViewSet,
                      basename='asset-export',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'hook-signal',
                      HookSignalViewSet,
                      basename='hook-signal',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'paired-data',
                      PairedDataViewset,
                      basename='paired-data',
                      parents_query_lookups=['asset'],
                      )

data_routes = asset_routes.register(r'data',
                                    DataViewSet,
                                    basename='submission',
                                    parents_query_lookups=['asset'],
                                    )

data_routes.register(r'attachment',
                     AttachmentViewSet,
                     basename='attachment',
                     parents_query_lookups=['asset', 'data'],
                     )

hook_routes = asset_routes.register(r'hooks',
                                    HookViewSet,
                                    basename='hook',
                                    parents_query_lookups=['asset'],
                                    )

hook_routes.register(r'logs',
                     HookLogViewSet,
                     basename='hook-log',
                     parents_query_lookups=['asset', 'hook'],
                     )

router_api_v2.register(r'asset_snapshots', AssetSnapshotViewSet)
router_api_v2.register(
    r'asset_subscriptions', UserAssetSubscriptionViewSet)
router_api_v2.register(r'users', UserViewSet)
router_api_v2.register(r'permissions', PermissionViewSet)
router_api_v2.register(r'imports', ImportTaskViewSet)

# TODO migrate ViewSet below
# router_api_v2.register(r'sitewide_messages', SitewideMessageViewSet)
#
# router_api_v2.register(r'authorized_application/users',
#                        AuthorizedApplicationUserViewSet,
#                        basename='authorized_applications')
# router_api_v2.register(r'authorized_application/one_time_authentication_keys',
#                        OneTimeAuthenticationKeyViewSet)
