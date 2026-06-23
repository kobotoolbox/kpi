from django.urls import include, path
from rest_framework.renderers import JSONRenderer
from rest_framework_extensions.routers import ExtendedDefaultRouter

from kobo.apps.audit_log.urls import router as audit_log_router
from kobo.apps.audit_log.views import ProjectHistoryLogViewSet
from kobo.apps.hook.views.v2.hook import HookViewSet
from kobo.apps.hook.views.v2.hook_log import HookLogViewSet
from kobo.apps.languages.urls import router as language_router
from kobo.apps.organizations.views import (
    OrganizationMemberViewSet,
    OrganizationViewSet,
    OrgMembershipInviteViewSet,
)
from kobo.apps.project_ownership.urls import router as project_ownership_router
from kobo.apps.project_views.views import ProjectViewViewSet
from kobo.apps.subsequences.views import (
    BulkAcceptViewSet,
    BulkActionViewSet,
    QuestionAdvancedFeatureViewSet,
)
from kobo.apps.user_reports.views import UserReportsViewSet
from kpi.constants import API_NAMESPACES
from kpi.permissions import AdvancedSubmissionPermission
from kpi.renderers import BasicHTMLRenderer
from kpi.views.v2.asset import AssetViewSet
from kpi.views.v2.attachment_audio_duration import AttachmentAudioDurationViewSet
from kpi.views.v2.asset_export_settings import AssetExportSettingsViewSet
from kpi.views.v2.asset_file import AssetFileViewSet
from kpi.views.v2.asset_permission_assignment import AssetPermissionAssignmentViewSet
from kpi.views.v2.asset_snapshot import AssetSnapshotViewSet
from kpi.views.v2.asset_submission_counts import AssetSubmissionCountsViewSet
from kpi.views.v2.asset_usage import AssetUsageViewSet
from kpi.views.v2.asset_version import AssetVersionViewSet
from kpi.views.v2.attachment import AttachmentViewSet
from kpi.views.v2.attachment_delete import AttachmentDeleteViewSet
from kpi.views.v2.authorized_application_user import AuthorizedApplicationUserViewSet
from kpi.views.v2.data import DataViewSet
from kpi.views.v2.environment import EnvironmentView
from kpi.views.v2.export_task import ExportTaskViewSet
from kpi.views.v2.import_task import ImportTaskViewSet
from kpi.views.v2.paired_data import PairedDataViewset
from kpi.views.v2.permission import PermissionViewSet
from kpi.views.v2.service_usage import ServiceUsageViewSet
from kpi.views.v2.tag import TagViewSet
from kpi.views.v2.tos import TermsOfServiceViewSet
from kpi.views.v2.user import UserViewSet
from kpi.views.v2.user_asset_subscription import UserAssetSubscriptionViewSet


class OpenRosaCompatibleExtendedRouter(ExtendedDefaultRouter):
    """
    The DRF router adds trailing slashes to all URL patterns by default.
    Django's APPEND_SLASH redirects requests missing their trailing slash,
    which loses POST payloads.

    This router creates alias URL patterns without trailing slashes for
    OpenRosa endpoints so they can be served directly without redirection.
    """

    OPENROSA_ENDPOINT_NAMES = {
        'assetsnapshot-form-list': ('asset_snapshots/<uid_asset_snapshot>/formList'),
        'assetsnapshot-manifest': ('asset_snapshots/<uid_asset_snapshot>/manifest'),
        'assetsnapshot-submission': ('asset_snapshots/<uid_asset_snapshot>/submission'),
    }

    def get_urls(self, *args, **kwargs):
        urls = super().get_urls(*args, **kwargs)
        names_to_alias = dict(self.OPENROSA_ENDPOINT_NAMES)
        original_urls = [url for url in urls if url.name not in names_to_alias]
        for url in urls:
            if url.name in names_to_alias:
                alias_path = names_to_alias.pop(url.name)
                original_urls.append(
                    path(
                        alias_path,
                        url.callback,
                        name=f'{url.name}-openrosa',
                    )
                )
        return original_urls


URL_NAMESPACE = API_NAMESPACES['v2']

router_api_v2 = OpenRosaCompatibleExtendedRouter()
asset_routes = router_api_v2.register(r'assets', AssetViewSet, basename='asset')

asset_routes.register(
    r'counts',
    AssetSubmissionCountsViewSet,
    basename='asset-counts',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'files',
    AssetFileViewSet,
    basename='asset-file',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'permission-assignments',
    AssetPermissionAssignmentViewSet,
    basename='asset-permission-assignment',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'versions',
    AssetVersionViewSet,
    basename='asset-version',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'export-settings',
    AssetExportSettingsViewSet,
    basename='asset-export-settings',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'exports',
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

asset_routes.register(
    r'attachments/audio-duration',
    AttachmentAudioDurationViewSet,
    basename='asset-attachment-audio-duration',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'attachments',
    AttachmentDeleteViewSet,
    basename='asset-attachments',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'advanced-features/bulk-actions',
    BulkActionViewSet,
    basename='advanced-features-bulk-actions',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'advanced-features/accept',
    BulkAcceptViewSet,
    basename='advanced-features-accept',
    parents_query_lookups=['asset'],
)

asset_routes.register(
    r'advanced-features',
    QuestionAdvancedFeatureViewSet,
    basename='advanced-features',
    parents_query_lookups=['asset'],
)

data_routes = asset_routes.register(
    r'data',
    DataViewSet,
    basename='submission',
    parents_query_lookups=['asset'],
)

data_routes.register(
    r'attachments',
    AttachmentViewSet,
    basename='attachment',
    parents_query_lookups=['asset', 'data'],
)

hook_routes = asset_routes.register(
    r'hooks',
    HookViewSet,
    basename='hook',
    parents_query_lookups=['asset'],
)

hook_routes.register(
    r'logs',
    HookLogViewSet,
    basename='hook-log',
    parents_query_lookups=['asset', 'hook'],
)

router_api_v2.register(r'asset_snapshots', AssetSnapshotViewSet)
router_api_v2.register(r'asset_subscriptions', UserAssetSubscriptionViewSet)
router_api_v2.register(r'asset_usage', AssetUsageViewSet, basename='asset-usage')
router_api_v2.register(r'imports', ImportTaskViewSet)
router_api_v2.register(
    r'organizations',
    OrganizationViewSet,
    basename='organizations',
)
router_api_v2.register(
    r'organizations/(?P<uid_organization>[^/.]+)/members',
    OrganizationMemberViewSet,
    basename='organization-members',
)
router_api_v2.register(
    r'organizations/(?P<uid_organization>[^/.]+)/invites',
    OrgMembershipInviteViewSet,
    basename='organization-invites',
)

router_api_v2.register(r'permissions', PermissionViewSet)
router_api_v2.register(r'project-views', ProjectViewViewSet)
router_api_v2.register(r'service_usage', ServiceUsageViewSet, basename='service-usage')
router_api_v2.register(r'users', UserViewSet, basename='user-kpi')
router_api_v2.register(r'user-reports', UserReportsViewSet, basename='user-reports')
router_api_v2.register(r'tags', TagViewSet, basename='tags')
router_api_v2.register(
    r'terms-of-service', TermsOfServiceViewSet, basename='terms-of-service'
)

# Merge django apps routers with API v2 router
# All routes are under `/api/v2/` within the same namespace.
router_api_v2.registry.extend(project_ownership_router.registry)
router_api_v2.registry.extend(language_router.registry)
router_api_v2.registry.extend(audit_log_router.registry)


router_api_v2.register(
    r'authorized_application/users',
    AuthorizedApplicationUserViewSet,
    basename='authorized_applications',
)


# Create aliases here instead of using complex regex patterns in the `url_path`
# parameter of the @action decorator. DRF and drf-spectacular struggle to interpret
# them correctly, often resulting in broken routes and schema generation errors.
enketo_url_aliases = [
    path(
        'assets/<uid_asset>/data/<pk>/edit/',
        DataViewSet.as_view(
            {'get': 'enketo_edit'}, renderer_classes=[JSONRenderer, BasicHTMLRenderer]
        ),
        name='submission-enketo-edit-legacy',
    ),
    path(
        'assets/<uid_asset>/data/<pk>/enketo/redirect/edit/',
        DataViewSet.as_view({'get': 'enketo_edit'}, renderer_classes=[JSONRenderer]),
        name='submission-enketo-edit-redirect',
    ),
    path(
        'assets/<uid_asset>/data/<pk>/enketo/redirect/view/',
        DataViewSet.as_view({'get': 'enketo_view'}, renderer_classes=[JSONRenderer]),
        name='submission-enketo-view-redirect',
    ),
]

# Declared here instead of using `@action` on the ViewSet because it requires a
# custom lookup field (`root_uuid`), which is not supported by DRF Spectacular.
supplement_url_patterns = [
    path(
        'assets/<uid_asset>/data/<root_uuid>/supplement/',
        DataViewSet.as_view(
            {'get': 'supplement', 'patch': 'supplement'},
            renderer_classes=[JSONRenderer],
            permission_classes=[AdvancedSubmissionPermission],
        ),
        name='submission-supplement',
    ),
]

kobo_scim_url_patterns = [
    path(
        'scim/v2/',
        include('kobo.apps.kobo_scim.urls', namespace='kobo_scim'),
    ),
]

additional_urls = [
    path(r'environment/', EnvironmentView.as_view(), name='environment')
]

urls_patterns = (
    router_api_v2.urls
    + enketo_url_aliases
    + supplement_url_patterns
    + kobo_scim_url_patterns
    + additional_urls
)
