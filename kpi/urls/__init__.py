import private_storage.urls
from django.conf import settings
from django.urls import include, path, re_path
from django.views.i18n import JavaScriptCatalog

from hub.models import ConfigurationFile
from kpi.views import authorized_application_authenticate_user, home, modern_browsers
from kpi.views.current_user import CurrentUserViewSet
from kpi.views.environment import EnvironmentView
from kpi.views.token import TokenView
from kpi.views.v2.authorized_application_user import AuthorizedApplicationUserViewSet
from kpi.views.v2.logout import logout_from_all_devices
from .router_api_v1 import urls_patterns as router_api_v1_urls
from .router_api_v2 import URL_NAMESPACE
from .router_api_v2 import urls_patterns as router_api_v2_urls

# TODO: Give other apps their own `urls.py` files instead of importing their
# views directly! See
# https://docs.djangoproject.com/en/1.8/intro/tutorial03/#namespacing-url-names


# Apps whose translations should be available in the client code.
urlpatterns = [
    path('', home, name='kpi-root'),
    path('me/', CurrentUserViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'delete': 'destroy',
    }), name='currentuser-detail'),
    re_path(r'^', include(router_api_v1_urls)),
    re_path(r'^api/v2/', include((router_api_v2_urls, URL_NAMESPACE))),
    path('api/scim/v2/', include('kobo.apps.kobo_scim.urls')),
    path('', include('kobo.apps.accounts.urls')),
    path('', include('kobo.apps.service_health.urls')),
    re_path(r'^o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    # DEPRECATED, remove with v1
    path(
        'authorized_application/authenticate_user/',
        authorized_application_authenticate_user,
        name='authenticate_user',
    ),
    path(
        'api/v2/authorized_application/authenticate_user/',
        AuthorizedApplicationUserViewSet.as_view({'post': 'authenticate_user'}),
        name='authorized-application-authenticate-user',
    ),
    path('modern_browsers/', modern_browsers),
    re_path(r'^i18n/', include('django.conf.urls.i18n')),
    # Translation catalog for client code.
    path('jsi18n/', JavaScriptCatalog.as_view(),
         name='javascript-catalog'),
    path('token/', TokenView.as_view(), name='token'),
    path('environment/', EnvironmentView.as_view(), name='environment'),
    re_path(r'^configurationfile/(?P<slug>[^/]+)/?',
            ConfigurationFile.content_view, name='configurationfile'),
    re_path(r'^private-media/', include(private_storage.urls)),
    # Statistics for superusers
    re_path(
        r'^superuser_stats/',
        include(('kobo.apps.superuser_stats.urls', 'superuser_stats')),
    ),
    path('logout-all/', logout_from_all_devices, name='logout_all'),
]


if settings.STRIPE_ENABLED:
    urlpatterns = [
        re_path(r'^api/v2/stripe/', include('kobo.apps.stripe.urls')),
        re_path(r'^api/v2/stripe/', include('djstripe.urls', namespace='djstripe')),
    ] + urlpatterns


if settings.DEBUG and settings.ENV == 'dev':
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls)),
    ] + urlpatterns
