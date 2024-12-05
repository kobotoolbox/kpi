from rest_framework.routers import DefaultRouter

from .views import (
    AccessLogsExportViewSet,
    AccessLogViewSet,
    AllAccessLogsExportViewSet,
    AllAccessLogViewSet,
    AllProjectHistoryLogViewSet,
    AuditLogViewSet,
)

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'access-logs', AllAccessLogViewSet, basename='all-access-logs')
router.register(r'access-logs/me', AccessLogViewSet, basename='access-log')
# routes for PH logs for individual assets are registered in router_api_v2.py
router.register(
    r'project-history-logs',
    AllProjectHistoryLogViewSet,
    basename='all-project-history-logs',
)
router.register(
    r'access-logs/export', AllAccessLogsExportViewSet, basename='all-access-logs-export'
)
router.register(
    r'access-logs/me/export', AccessLogsExportViewSet, basename='access-logs-export'
)

urlpatterns = []
