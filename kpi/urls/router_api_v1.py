from django.urls import path
from rest_framework_extensions.routers import ExtendedDefaultRouter

from kobo.apps.hook.views.v1.hook import HookViewSet
from kobo.apps.hook.views.v1.hook_log import HookLogViewSet
from kobo.apps.reports.views import ReportsViewSet
from kpi.views.v1 import (
    AssetFileViewSet,
    AssetSnapshotViewSet,
    AssetVersionViewSet,
    AssetViewSet,
    AuthorizedApplicationUserViewSet,
    ExportTaskViewSet,
    ImportTaskViewSet,
    ObjectPermissionViewSet,
    SubmissionViewSet,
    TagViewSet,
    UserAssetSubscriptionViewSet,
    UserViewSet,
)

router_api_v1 = ExtendedDefaultRouter()
asset_routes = router_api_v1.register(r'assets', AssetViewSet, basename='asset')
asset_routes.register(r'versions',
                      AssetVersionViewSet,
                      basename='asset-version',
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
router_api_v1.register(r'users', UserViewSet, basename='user-kpi')
router_api_v1.register(r'tags', TagViewSet, basename='tags')
router_api_v1.register(r'permissions', ObjectPermissionViewSet)
router_api_v1.register(r'reports', ReportsViewSet, basename='reports')
router_api_v1.register(r'imports', ImportTaskViewSet)
router_api_v1.register(r'exports', ExportTaskViewSet)

router_api_v1.register(r'authorized_application/users',
                       AuthorizedApplicationUserViewSet,
                       basename='authorized_applications')


# Create aliases here instead of using complex regex patterns in the `url_path`
# parameter of the @action decorator. DRF and drf-spectacular struggle to interpret
# them correctly, often resulting in broken routes and schema generation errors.
enketo_url_aliases = [
    path(
        'assets/<uid_asset>/submissions/<pk>/edit/',
        SubmissionViewSet.as_view({'get': 'enketo_edit'}),
        name='submission-enketo-edit-legacy',
    ),
    path(
        'assets/<uid_asset>/submissions/<pk>/enketo/redirect/edit/',
        SubmissionViewSet.as_view({'get': 'enketo_edit'}),
        name='submission-enketo-edit-redirect',
    ),
    path(
        'assets/<uid_asset>/submissions/<pk>/enketo/redirect/view/',
        SubmissionViewSet.as_view({'get': 'enketo_view'}),
        name='submission-enketo-view-redirect',
    ),
]
urls_patterns = router_api_v1.urls + enketo_url_aliases
