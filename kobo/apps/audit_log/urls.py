from django.urls import path

from .views import AuditLogViewSet


urlpatterns = [
    path('', AuditLogViewSet.as_view({'get': 'list'}), name='audit-log-list'),
]
