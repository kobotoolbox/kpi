# coding: utf-8
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
from kpi.views.v2.data import DataViewSet
from kpi.views.v2.export_task import ExportTaskViewSet
from kpi.views.v2.import_task import ImportTaskViewSet
from kpi.views.v2.paired_data import PairedDataViewset
from kpi.views.v2.permission import PermissionViewSet
from kpi.views.v2.user import UserViewSet
from kpi.views.v2.user_asset_subscription import UserAssetSubscriptionViewSet


URL_NAMESPACE = 'api_v2'

router_api_v2 = ExtendedDefaultRouter()
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

asset_routes.register(r'data',
                      DataViewSet,
                      basename='submission',
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
