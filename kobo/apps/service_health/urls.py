from django.urls import path

from .views import service_health, service_health_minimal

urlpatterns = [
    path('service_health/', service_health, name='service-health'),
    path(
        'service_health/minimal/',
        service_health_minimal,
        name='service-health-minimal',
    ),
]
