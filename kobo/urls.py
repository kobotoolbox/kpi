from django.conf import settings
from django.conf.urls import url, include
from django.contrib import admin
from django.views.generic.base import RedirectView


admin.autodiscover()

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    # https://github.com/stochastic-technologies/django-loginas
    url(r'^admin/', include('loginas.urls')),
    url(r'^', include('kpi.urls')),
    url(r'^service_health/$', 'kobo.apps.service_health.views.service_health'),
    url(r'kobocat/', RedirectView.as_view(url=settings.KOBOCAT_URL, permanent=True)),
]
