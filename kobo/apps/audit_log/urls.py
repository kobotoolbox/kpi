from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AccessLogViewSet, AllAccessLogViewSet, AuditLogViewSet

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'access-logs', AccessLogViewSet, basename='access-log')
router.register(
    r'access-logs/all', AllAccessLogViewSet, basename='all-access-logs'
)

urlpatterns = []
