# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from django.conf.urls import url, include
from django.views.i18n import javascript_catalog
import private_storage.urls

from hub.models import ConfigurationFile
from hub.views import ExtraDetailRegistrationView
from hub.views import switch_builder
from kpi.forms import RegistrationForm
from kpi.views import authorized_application_authenticate_user
from kpi.views import home, one_time_login, browser_tests
from kpi.views.environment import EnvironmentView
from kpi.views.current_user import CurrentUserViewSet
from kpi.views.token import TokenView

from .router_api_v1 import router_api_v1
from .router_api_v2 import router_api_v2, URL_NAMESPACE

# TODO: Give other apps their own `urls.py` files instead of importing their
# views directly! See
# https://docs.djangoproject.com/en/1.8/intro/tutorial03/#namespacing-url-names


# Apps whose translations should be available in the client code.
js_info_dict = {
    'packages': ('kobo.apps.KpiConfig',),
}

urlpatterns = [
    url(r'^$', home, name='kpi-root'),
    url(r'^me/$', CurrentUserViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
    }), name='currentuser-detail'),
    url(r'^', include(router_api_v1.urls)),
    url(r'^api/v2/', include(router_api_v2.urls, namespace=URL_NAMESPACE)),
    url(r'^api-auth/', include('rest_framework.urls',
                               namespace='rest_framework')),
    url(r'^accounts/register/$', ExtraDetailRegistrationView.as_view(
        form_class=RegistrationForm), name='registration_register'),
    url(r'^accounts/logout/', 'django.contrib.auth.views.logout',
        {'next_page': '/'}),
    url(r'^accounts/', include('registration.backends.default.urls')),
    url(r'^o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    url(
        r'^authorized_application/authenticate_user/$',
        authorized_application_authenticate_user
    ),
    url(r'^browser_tests/$', browser_tests),
    url(r'^authorized_application/one_time_login/$', one_time_login),
    url(r'^hub/switch_builder$', switch_builder, name='toggle-preferred-builder'),
    url(r'^i18n/', include('django.conf.urls.i18n')),
    # Translation catalog for client code.
    url(r'^jsi18n/$', javascript_catalog, js_info_dict, name='javascript-catalog'),

    url(r'^token/$', TokenView.as_view(), name='token'),
    url(r'^environment/$', EnvironmentView.as_view(), name='environment'),
    url(r'^configurationfile/(?P<slug>[^/]+)/?',
        ConfigurationFile.redirect_view, name='configurationfile'),
    url(r'^private-media/', include(private_storage.urls)),
    # Statistics for superusers
    url(r'^superuser_stats/user_report/$',
        'kobo.apps.superuser_stats.views.user_report'),
    url(r'^superuser_stats/user_report/(?P<base_filename>[^/]+)$',
        'kobo.apps.superuser_stats.views.retrieve_user_report'),
]
