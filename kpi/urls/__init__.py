# coding: utf-8
import private_storage.urls
from django.conf import settings
from django.urls import include, re_path, path
from django.views.i18n import JavaScriptCatalog

from hub.models import ConfigurationFile
from kobo.apps.superuser_stats.views import (
    user_report,
    user_details_report,
    country_report,
    retrieve_reports,
)
from kobo.apps.accounts.mfa.views import (
    MfaLoginView,
    MfaTokenView,
)
from kpi.views import authorized_application_authenticate_user
from kpi.views import home, browser_tests, design_system, modern_browsers
from kpi.views.environment import EnvironmentView
from kpi.views.current_user import CurrentUserViewSet
from kpi.views.token import TokenView

from .router_api_v1 import router_api_v1
from .router_api_v2 import router_api_v2, URL_NAMESPACE

# TODO: Give other apps their own `urls.py` files instead of importing their
# views directly! See
# https://docs.djangoproject.com/en/1.8/intro/tutorial03/#namespacing-url-names


# Apps whose translations should be available in the client code.
urlpatterns = [
    path('', home, name='kpi-root'),
    path('me/', CurrentUserViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
    }), name='currentuser-detail'),
    re_path(r'^', include(router_api_v1.urls)),
    re_path(r'^api/v2/', include((router_api_v2.urls, URL_NAMESPACE))),
    re_path(r'^api/v2/', include('kobo.apps.languages.urls')),
    path('', include('kobo.apps.accounts.urls')),
    re_path(r'^api/v2/audit-logs/', include('kobo.apps.audit_log.urls')),
    re_path(r'^o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    re_path(
        r'^authorized_application/authenticate_user/$',
        authorized_application_authenticate_user
    ),
    path('browser_tests/', browser_tests),
    path('modern_browsers/', modern_browsers),
    path('design-system/', design_system),
    re_path(r'^i18n/', include('django.conf.urls.i18n')),
    # Translation catalog for client code.
    path('jsi18n/', JavaScriptCatalog.as_view(),
         name='javascript-catalog'),
    path('token/', TokenView.as_view(), name='token'),
    path('environment/', EnvironmentView.as_view(), name='environment'),
    re_path(r'^configurationfile/(?P<slug>[^/]+)/?',
            ConfigurationFile.redirect_view, name='configurationfile'),
    re_path(r'^private-media/', include(private_storage.urls)),
    # Statistics for superusers
    re_path(r'^superuser_stats/', include(('kobo.apps.superuser_stats.urls', 'superuser_stats'))),
]


if settings.STRIPE_ENABLED:
    urlpatterns = [
        re_path(r'^api/v2/stripe/', include('kobo.apps.stripe.urls'))
    ] + urlpatterns


if settings.DEBUG and settings.ENV == 'dev':
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls)),
    ] + urlpatterns
