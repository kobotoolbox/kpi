from rest_framework.routers import DefaultRouter

from .views import AccessLogViewSet, AllAccessLogViewSet, AuditLogViewSet

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'access-logs', AllAccessLogViewSet, basename='all-access-logs')
router.register(r'access-logs/me', AccessLogViewSet, basename='access-log')

urlpatterns = []
