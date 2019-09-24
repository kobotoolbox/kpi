# -*- coding: utf-8 -*-
from __future__ import absolute_import

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
    CollectionViewSet,
    ExportTaskViewSet,
    ImportTaskViewSet,
    ObjectPermissionViewSet,
    OneTimeAuthenticationKeyViewSet,
    SitewideMessageViewSet,
    SubmissionViewSet,
    UserViewSet,
    UserCollectionSubscriptionViewSet,
    TagViewSet,
)

router_api_v1 = ExtendedDefaultRouter()
asset_routes = router_api_v1.register(r'assets', AssetViewSet, base_name='asset')
asset_routes.register(r'versions',
                      AssetVersionViewSet,
                      base_name='asset-version',
                      parents_query_lookups=['asset'],
                      )
asset_routes.register(r'hook-signal',
                      HookSignalViewSet,
                      base_name='hook-signal',
                      parents_query_lookups=['asset'],
                      )
asset_routes.register(r'submissions',
                      SubmissionViewSet,
                      base_name='submission',
                      parents_query_lookups=['asset'],
                      )
asset_routes.register(r'files',
                      AssetFileViewSet,
                      base_name='asset-file',
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

router_api_v1.register(r'asset_snapshots', AssetSnapshotViewSet)
router_api_v1.register(
    r'collection_subscriptions', UserCollectionSubscriptionViewSet)
router_api_v1.register(r'collections', CollectionViewSet)
router_api_v1.register(r'users', UserViewSet)
router_api_v1.register(r'tags', TagViewSet)
router_api_v1.register(r'permissions', ObjectPermissionViewSet)
router_api_v1.register(r'reports', ReportsViewSet, base_name='reports')
router_api_v1.register(r'imports', ImportTaskViewSet)
router_api_v1.register(r'exports', ExportTaskViewSet)
router_api_v1.register(r'sitewide_messages', SitewideMessageViewSet)

router_api_v1.register(r'authorized_application/users',
                       AuthorizedApplicationUserViewSet,
                       base_name='authorized_applications')
router_api_v1.register(r'authorized_application/one_time_authentication_keys',
                       OneTimeAuthenticationKeyViewSet)
