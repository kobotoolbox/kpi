# coding: utf-8
from django.conf import settings
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse, HttpRequest
from django.shortcuts import render
from django.urls import include, path, re_path
from django.views.generic.base import RedirectView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from rest_framework import status
from rest_framework.exceptions import server_error
from rest_framework_extensions import routers
from kpi.utils.urls import is_request_for_html
from kpi.urls.router_api_v1 import router_api_v1
from kpi.urls.router_api_v2 import router_api_v2
from kpi.views.v2.test_view import TestViewSet

admin.autodiscover()
admin.site.login = staff_member_required(
    admin.site.login, login_url=settings.LOGIN_URL
)

router_api_v3 = routers.SimpleRouter()
router_api_v3.register('tests', TestViewSet, basename='tests')

urlpatterns = [
    # https://github.com/stochastic-technologies/django-loginas
    re_path(r'^admin/', include('loginas.urls')),
    # Disable admin login form
    re_path(r'^admin/', admin.site.urls),
    path('', include('kobo.apps.accounts.mfa.urls')),
    path('accounts/', include('allauth.urls')),  # Must be after kpi.url, login
    re_path(
        r'^accounts/register/?',
        RedirectView.as_view(url='/accounts/signup/', permanent=False),
    ),
    re_path(r'^', include('kobo.apps.subsequences.urls')),
    re_path(r'^', include('kpi.urls')),
    re_path(r'^', include('kobo.apps.openrosa.apps.main.urls')),
    re_path(r'^markdownx/', include('markdownx.urls')),
    re_path(r'^markdownx-uploader/', include('kobo.apps.markdownx_uploader.urls')),
    re_path(r'^help/', include('kobo.apps.help.urls')),
]
urlpatterns += [
    re_path(r'^api/v3/', include(router_api_v3.urls)),
    path('api/v2/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v2/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.ENABLE_METRICS:
    urlpatterns.append(
        path('', include('django_prometheus.urls')),
    )


def render404(request: HttpRequest, exception):
    if is_request_for_html(request):
        return render(request, 'custom_404.html', status=404)
    # fall back to a basic JSON response if a data route is being requested
    return HttpResponse('Resource not found (404)', status=status.HTTP_404_NOT_FOUND)


def render500(request: HttpRequest):
    if is_request_for_html(request):
        return render(request, 'custom_500.html', status=500)
    # fall back to the DRF 500 handler if a data route is being requested
    return server_error(request)


# override the django error page handlers with our own
handler404 = render404
handler500 = render500
