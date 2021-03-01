# coding: utf-8
from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
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

    # Sometimes nothing is helpful for debugging, e.g. to host the Django
    # Debug Toolbar when inspecting the history of JSON API requests
    #
    # path(
    #     'nada/',
    #     lambda *args, **kwargs: HttpResponse(
    #         '<html><head><title>Wow</title></head>'
    #         '<body><h1>You found it! 🌈</h1></body></html>'
    #     ),
    # ),
]
