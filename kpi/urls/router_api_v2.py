# coding: utf-8

from django.urls import path
from rest_framework_extensions.routers import ExtendedDefaultRouter

from kobo.apps.audit_log.urls import router as audit_log_router
from kobo.apps.audit_log.views import ProjectHistoryLogViewSet
from kobo.apps.hook.views.v2.hook import HookViewSet
from kobo.apps.hook.views.v2.hook_log import HookLogViewSet
from kobo.apps.languages.urls import router as language_router
from kobo.apps.organizations.views import OrganizationMemberViewSet, OrganizationViewSet, OrgMembershipInviteViewSet
from kobo.apps.project_ownership.urls import router as project_ownership_router
from kobo.apps.project_views.views import ProjectViewViewSet
from kpi.views.v2.asset import AssetViewSet
from kpi.views.v2.asset_counts import AssetCountsViewSet
from kpi.views.v2.asset_export_settings import AssetExportSettingsViewSet
from kpi.views.v2.asset_file import AssetFileViewSet
from kpi.views.v2.asset_permission_assignment import AssetPermissionAssignmentViewSet
from kpi.views.v2.asset_snapshot import AssetSnapshotViewSet
from kpi.views.v2.asset_usage import AssetUsageViewSet
from kpi.views.v2.asset_version import AssetVersionViewSet
from kpi.views.v2.attachment import AttachmentViewSet
from kpi.views.v2.data import DataViewSet
from kpi.views.v2.export_task import ExportTaskViewSet
from kpi.views.v2.import_task import ImportTaskViewSet
from kpi.views.v2.paired_data import PairedDataViewset
from kpi.views.v2.permission import PermissionViewSet
from kpi.views.v2.service_usage import ServiceUsageViewSet
from kpi.views.v2.user import UserViewSet
from kpi.views.v2.user_asset_subscription import UserAssetSubscriptionViewSet


class ExtendedDefaultRouterWithPathAliases(ExtendedDefaultRouter):
    """
    Historically, all of this application's endpoints have used trailing
    slashes (the DRF default). Requests missing their trailing slashes have
    been automatically redirected by Django's `APPEND_SLASH` setting, which
    defaults to `True`.

    That behavior is unacceptable for OpenRosa endpoints, which do *not* end
    with slashes and cannot be redirected without losing their POST payloads.

    This router explicitly adds URL patterns without trailing slashes for
    OpenRosa endpoints so that their responses can be served directly, without
    redirection.
    """
    def get_urls(self, *args, **kwargs):
        urls = super().get_urls(*args, **kwargs)
        names_to_alias_paths = {
            'assetsnapshot-form-list': 'asset_snapshots/<uid>/formList',
            'assetsnapshot-manifest': 'asset_snapshots/<uid>/manifest',
            'assetsnapshot-submission': 'asset_snapshots/<uid>/submission',
        }
        alias_urls = []
        for url in urls:
            if url.name in names_to_alias_paths:
                alias_paths = names_to_alias_paths[url.name]
                # only consider the first match
                del names_to_alias_paths[url.name]
                alias_urls.append(
                    path(alias_paths, url.callback, name=f'{url.name}-alias')
                )
        urls.extend(alias_urls)
        return urls


URL_NAMESPACE = 'api_v2'

router_api_v2 = ExtendedDefaultRouterWithPathAliases()
asset_routes = router_api_v2.register(r'assets', AssetViewSet, basename='asset')

asset_routes.register(r'counts',
                      AssetCountsViewSet,
                      basename='asset-counts',
                      parents_query_lookups=['asset'],
                      )

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

asset_routes.register(
    r'paired-data',
    PairedDataViewset,
    basename='paired-data',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'history',
    ProjectHistoryLogViewSet,
    basename='history',
    parents_query_lookups=['asset'],
)

data_routes = asset_routes.register(r'data',
                                    DataViewSet,
                                    basename='submission',
                                    parents_query_lookups=['asset'],
                                    )

data_routes.register(r'attachments',
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
router_api_v2.register(r'asset_subscriptions',
                       UserAssetSubscriptionViewSet)
router_api_v2.register(r'asset_usage', AssetUsageViewSet, basename='asset-usage')
router_api_v2.register(r'imports', ImportTaskViewSet)
router_api_v2.register(r'organizations',
                       OrganizationViewSet, basename='organizations',)
router_api_v2.register(
    r'organizations/(?P<organization_id>[^/.]+)/members',
    OrganizationMemberViewSet,
    basename='organization-members',
)
router_api_v2.register(
    r'organizations/(?P<organization_id>[^/.]+)/invites',
    OrgMembershipInviteViewSet,
    basename='organization-invite',
)

router_api_v2.register(r'permissions', PermissionViewSet)
router_api_v2.register(r'project-views', ProjectViewViewSet)
router_api_v2.register(r'service_usage',
                       ServiceUsageViewSet, basename='service-usage')
router_api_v2.register(r'users', UserViewSet, basename='user-kpi')


# Merge django apps routers with API v2 router
# All routes are under `/api/v2/` within the same namespace.
router_api_v2.registry.extend(project_ownership_router.registry)
router_api_v2.registry.extend(language_router.registry)
router_api_v2.registry.extend(audit_log_router.registry)


# TODO migrate ViewSet below
# router_api_v2.register(r'sitewide_messages', SitewideMessageViewSet)
#
# router_api_v2.register(r'authorized_application/users',
#                        AuthorizedApplicationUserViewSet,
#                        basename='authorized_applications')
