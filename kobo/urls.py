# coding: utf-8
from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic.base import RedirectView

from kobo.apps.service_health.views import service_health

admin.autodiscover()

urlpatterns = [
    re_path(r'^admin/', admin.site.urls),
    # https://github.com/stochastic-technologies/django-loginas
    re_path(r'^admin/', include('loginas.urls')),
    re_path(r'^', include('kpi.urls')),
    re_path(r'^markdownx/', include('markdownx.urls')),
    re_path(r'^help/', include('kobo.apps.help.urls')),
    path('service_health/', service_health),
    re_path(r'kobocat/', RedirectView.as_view(url=settings.KOBOCAT_URL, permanent=True)),
]
