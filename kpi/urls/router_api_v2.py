# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework_extensions.routers import ExtendedDefaultRouter

from kobo.apps.hook.views.v2.hook import HookViewSet
from kobo.apps.hook.views.v2.hook_log import HookLogViewSet
from kobo.apps.hook.views.v2.hook_signal import HookSignalViewSet

from kpi.views.v2.asset import AssetViewSet
from kpi.views.v2.asset_file import AssetFileViewSet
from kpi.views.v2.asset_permission import AssetPermissionViewSet
from kpi.views.v2.asset_snapshot import AssetSnapshotViewSet
from kpi.views.v2.asset_version import AssetVersionViewSet
from kpi.views.v2.collection import CollectionViewSet
from kpi.views.v2.data import DataViewSet

from kpi.views.v2.permission import PermissionViewSet
from kpi.views.v2.user import UserViewSet


URL_NAMESPACE = 'api_v2'

router_api_v2 = ExtendedDefaultRouter()
asset_routes = router_api_v2.register(r'assets', AssetViewSet, base_name='asset')

asset_routes.register(r'files',
                      AssetFileViewSet,
                      base_name='asset-file',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'permissions',
                      AssetPermissionViewSet,
                      base_name='asset-permission',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'versions',
                      AssetVersionViewSet,
                      base_name='asset-version',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'data',
                      DataViewSet,
                      base_name='submission',
                      parents_query_lookups=['asset'],
                      )

asset_routes.register(r'hook-signal',
                      HookSignalViewSet,
                      base_name='hook-signal',
                      parents_query_lookups=['asset'],
                      )

hook_routes = asset_routes.register(r'hooks',
                                    HookViewSet,
                                    base_name='hook',
                                    parents_query_lookups=['asset'],
                                    )

hook_routes.register(r'logs',
                     HookLogViewSet,
                     base_name='hook-log',
                     parents_query_lookups=['asset', 'hook'],
                     )

router_api_v2.register(r'asset_snapshots', AssetSnapshotViewSet)
router_api_v2.register(r'collections', CollectionViewSet)
router_api_v2.register(r'users', UserViewSet)
router_api_v2.register(r'permissions', PermissionViewSet)

# TODO migrate ViewSet below
# router_api_v2.register(r'reports', ReportsViewSet, base_name='reports')
# router_api_v2.register(r'imports', ImportTaskViewSet)
# router_api_v2.register(r'exports', ExportTaskViewSet)
# router_api_v2.register(r'sitewide_messages', SitewideMessageViewSet)
#
# router_api_v2.register(r'authorized_application/users',
#                        AuthorizedApplicationUserViewSet,
#                        base_name='authorized_applications')
# router_api_v2.register(r'authorized_application/one_time_authentication_keys',
#                        OneTimeAuthenticationKeyViewSet)
