import axes.decorators
from django.conf.urls import url, include
from django.contrib.auth.views import login
from django.views.i18n import javascript_catalog
from rest_framework.routers import DefaultRouter
from rest_framework_extensions.routers import ExtendedDefaultRouter

from hub.views import ExtraDetailRegistrationView
from hub.views import switch_builder
from kobo.apps.reports.views import ReportsViewSet
from kpi.forms import RegistrationForm
from kpi.views import (
    AssetSnapshotViewSet,
    AssetVersionViewSet,
    AssetViewSet,
    authorized_application_authenticate_user,
    AuthorizedApplicationUserViewSet,
    browser_tests,
    CollectionViewSet,
    CurrentUserViewSet,
    home,
    ImportTaskViewSet,
    login_locked,
    ObjectPermissionViewSet,
    one_time_login,
    OneTimeAuthenticationKeyViewSet,
    SitewideMessageViewSet,
    TagViewSet,
    UserCollectionSubscriptionViewSet,
    UserViewSet,
)


router = ExtendedDefaultRouter()
asset_routes = router.register(r'assets', AssetViewSet)
asset_routes.register(r'versions',
                      AssetVersionViewSet,
                      base_name='asset-version',
                      parents_query_lookups=['asset'],
                      )


router.register(r'asset_snapshots', AssetSnapshotViewSet)
router.register(
    r'collection_subscriptions', UserCollectionSubscriptionViewSet)
router.register(r'collections', CollectionViewSet)
router.register(r'users', UserViewSet)
router.register(r'tags', TagViewSet)
router.register(r'permissions', ObjectPermissionViewSet)
router.register(r'reports', ReportsViewSet, base_name='reports')
router.register(r'imports', ImportTaskViewSet)
router.register(r'sitewide_messages', SitewideMessageViewSet)

router.register(r'authorized_application/users',
                AuthorizedApplicationUserViewSet,
                base_name='authorized_applications')
router.register(r'authorized_application/one_time_authentication_keys',
                OneTimeAuthenticationKeyViewSet)

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
    url(r'^', include(router.urls)),
    url(r'^api-auth/', include('rest_framework.urls',
                               namespace='rest_framework')),
    url(r'^accounts/register/$', ExtraDetailRegistrationView.as_view(
        form_class=RegistrationForm), name='registration_register'),
    url(r'^accounts/logout/', 'django.contrib.auth.views.logout',
        {'next_page': '/'}),
    url(r'^accounts/login/$', axes.decorators.watch_login(login)),
    url(r'^accounts/', include('registration.backends.default.urls')),
    url(r'^o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    url(
        r'^authorized_application/authenticate_user/$',
        authorized_application_authenticate_user
    ),
    url(r'^browser_tests/$', browser_tests),
    url(r'^authorized_application/one_time_login/$', one_time_login),
    url(r'^hub/switch_builder$', switch_builder, name='toggle-preferred-builder'),
    # Translation catalog for client code.
    url(r'^jsi18n/$', javascript_catalog, js_info_dict, name='javascript-catalog'),
    # http://django-axes.readthedocs.io/en/latest/captcha.html
    url(r'^login_locked/$', login_locked),
    # http://django-simple-captcha.readthedocs.io/en/latest/usage.html
    url(r'^captcha/', include('captcha.urls')),
]
