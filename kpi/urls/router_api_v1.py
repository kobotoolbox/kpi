# coding: utf-8
from rest_framework_extensions.routers import ExtendedDefaultRouter

from kobo.apps.hook.views.v1.hook import HookViewSet
from kobo.apps.hook.views.v1.hook_log import HookLogViewSet
from kobo.apps.hook.views.v1.hook_signal import HookSignalViewSet

from kobo.apps.reports.views import ReportsViewSet
from kpi.views.v1 import (
    AssetViewSet,
    AssetVersionViewSet,
    AssetSnapshotViewSet,
    AssetFileViewSet,
    AuthorizedApplicationUserViewSet,
    ExportTaskViewSet,
    ImportTaskViewSet,
    ObjectPermissionViewSet,
    OneTimeAuthenticationKeyViewSet,
    SitewideMessageViewSet,
    SubmissionViewSet,
    UserViewSet,
    UserAssetSubscriptionViewSet,
    TagViewSet,
)

router_api_v1 = ExtendedDefaultRouter()
asset_routes = router_api_v1.register(r'assets', AssetViewSet, basename='asset')
asset_routes.register(r'versions',
                      AssetVersionViewSet,
                      basename='asset-version',
                      parents_query_lookups=['asset'],
                      )
asset_routes.register(r'hook-signal',
                      HookSignalViewSet,
                      basename='hook-signal',
                      parents_query_lookups=['asset'],
                      )
asset_routes.register(r'submissions',
                      SubmissionViewSet,
                      basename='submission',
                      parents_query_lookups=['asset'],
                      )
asset_routes.register(r'files',
                      AssetFileViewSet,
                      basename='asset-file',
                      parents_query_lookups=['asset'],
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

router_api_v1.register(r'asset_snapshots', AssetSnapshotViewSet)
router_api_v1.register(
    r'asset_subscriptions', UserAssetSubscriptionViewSet)
router_api_v1.register(r'users', UserViewSet)
router_api_v1.register(r'tags', TagViewSet)
router_api_v1.register(r'permissions', ObjectPermissionViewSet)
router_api_v1.register(r'reports', ReportsViewSet, basename='reports')
router_api_v1.register(r'imports', ImportTaskViewSet)
router_api_v1.register(r'exports', ExportTaskViewSet)
router_api_v1.register(r'sitewide_messages', SitewideMessageViewSet)

router_api_v1.register(r'authorized_application/users',
                       AuthorizedApplicationUserViewSet,
                       basename='authorized_applications')
router_api_v1.register(r'authorized_application/one_time_authentication_keys',
                       OneTimeAuthenticationKeyViewSet)
