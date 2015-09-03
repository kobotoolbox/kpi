from django.conf.urls import url, include

from django.contrib import admin

admin.autodiscover()

urlpatterns= [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^', include('kpi.urls'))
]
