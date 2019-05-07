# -*- coding: utf-8 -*-
from __future__ import absolute_import

from rest_framework_extensions.routers import ExtendedDefaultRouter

from kobo.apps.hook.views import HookViewSet, HookLogViewSet
from kpi.views.v1 import (
    AssetVersionViewSet,
    AssetFileViewSet,
    HookSignalViewSet,
    SubmissionViewSet,
)

from kpi.views.v2.asset import AssetViewSet
from kpi.views.v2.collection import CollectionViewSet
from kpi.views.v2.asset_snapshot import AssetSnapshotViewSet
from kpi.views.v2.user import UserViewSet


router_api_v2 = ExtendedDefaultRouter()
asset_routes = router_api_v2.register(r'assets', AssetViewSet, base_name='asset')
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
asset_routes.register(r'data',
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

router_api_v2.register(r'asset_snapshots', AssetSnapshotViewSet)
router_api_v2.register(r'collections', CollectionViewSet)
router_api_v2.register(r'users', UserViewSet)
