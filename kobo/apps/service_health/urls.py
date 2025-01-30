from django.urls import path

from .views import service_health

urlpatterns = [
    path('service_health/', service_health, name='service-health'),
]
