from rest_framework.routers import DefaultRouter

from .views import (
    AccessLogViewSet,
    AllAccessLogViewSet,
    AllProjectHistoryLogViewSet,
    AuditLogViewSet,
)

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'access-logs', AllAccessLogViewSet, basename='all-access-logs')
router.register(
    r'access-logs/me', AccessLogViewSet, basename='access-log'
)
# the route for project history logs for a specific asset is registered in router_api_v2
# because it acts as a subroute of /assets
router.register(
    r'project-history-logs', AllProjectHistoryLogViewSet, basename='all-project-logs'
)

urlpatterns = []
