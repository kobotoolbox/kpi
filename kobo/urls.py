from allauth import urls as allauth_urls
from allauth.headless import urls as headless_urls
from django.conf import settings
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import user_passes_test
from django.http import HttpRequest, HttpResponse
from django.urls import include, path, re_path
from django.views.generic.base import RedirectView
from drf_spectacular.views import SpectacularAPIView
from markdownx.views import MarkdownifyView
from rest_framework import status
from rest_framework.exceptions import server_error

from kobo.apps.accounts.mfa.views import (
    MfaAuthenticateView,
    MfaLoginView,
    MfaReauthenticateView,
)
from kobo.apps.accounts.views import (
    HeadlessLoginView,
    HeadlessManageRecoveryCodesView,
    HeadlessManageTOTPView,
    HeadlessMfaAuthenticateView,
    HeadlessMfaReauthenticateView,
)
from kobo.apps.kobo_scim.provisioning import SocialAccountProvisioningHTMLView
from kpi.utils.spectacular_processing import (
    OpenRosaAPISchemaGenerator,
    V2APISchemaGenerator,
)
from kpi.utils.urls import exclude_routes, is_request_for_html, replace_route_views
from kpi.views.error_pages import render_500_page, render_error_page
from kpi.views.v1_api_gone import v1_api_gone_view
from kpi.views.v2.swagger_ui import ExtendedSwaggerUIView

# allauth's templated pages that would bypass KPI's rules for changing the email
# address (`/me/emails/` is the only way), the password (`PATCH /me/`) or turning
# 2FA off (allauth's headless TOTP endpoint), by name. They are excluded from
# allauth's routes, but their names are kept, which allauth reverses, for routes
# redirecting to the matching page of the frontend
ALLAUTH_PAGE_REDIRECTS = {
    'account_email': ('accounts/email/', '/#/account/settings'),
    'account_change_password': ('accounts/password/change/', '/#/account/security'),
    'mfa_deactivate_totp': ('accounts/2fa/totp/deactivate/', '/#/account/security'),
}

# allauth's headless routes, without the ones bypassing the rules above, and
# with KPI's views where KPI adds rules of its own
ALLAUTH_HEADLESS_URL_PATTERNS = replace_route_views(
    exclude_routes(
        headless_urls.urlpatterns, {'manage_email', 'account:change_password'}
    ),
    {
        'mfa:authenticate': HeadlessMfaAuthenticateView,
        'mfa:reauthenticate': HeadlessMfaReauthenticateView,
        'mfa:manage_totp': HeadlessManageTOTPView,
        'mfa:manage_recovery_codes': HeadlessManageRecoveryCodesView,
        'account:login': HeadlessLoginView,
    },
)

ALLAUTH_URL_PATTERNS = replace_route_views(
    exclude_routes(allauth_urls.urlpatterns, set(ALLAUTH_PAGE_REDIRECTS)),
    {
        'account_login': MfaLoginView,
        'mfa_authenticate': MfaAuthenticateView,
        'mfa_reauthenticate': MfaReauthenticateView,
    },
)

admin.autodiscover()
admin.site.login = staff_member_required(admin.site.login, login_url=settings.LOGIN_URL)

# V1 API fall-through route. This ensures removed V1 routes return a 410
# instructing users to read the API migration guide.
REMOVED_V1_API_PREFIXES = [
    'api/v1',
    'asset_snapshots',
    'asset_subscriptions',
    'assets',
    'authorized_application',
    'environment',
    'exports',
    'imports',
    'permissions',
    'reports',
    'sitewide_messages',
    'tags',
    'users',
    'formUpload',
    'upload',
]

urlpatterns = [
    # Must stay first: main.urls has a catch-all path('<str:username>/')
    # that would intercept single-segment paths before these can match.
    *[
        re_path(
            rf'^{prefix}(/.*)?$',
            v1_api_gone_view,
            name=f'v1_api_gone-{prefix.replace("/", "-")}',
        )
        for prefix in REMOVED_V1_API_PREFIXES
    ],
    path(
        'api/v2/schema/',
        SpectacularAPIView.as_view(
            api_version='api_v2', generator_class=V2APISchemaGenerator
        ),
        name='schema',
    ),
    path(
        'api/v2/docs/',
        ExtendedSwaggerUIView.as_view(url_name='schema'),
        name='swagger-ui',
    ),
    path(
        'api/openrosa/schema/',
        SpectacularAPIView.as_view(
            # Acts as a pseudo-namespace to tag and identify the generated schema.
            # While not an actual Python namespace, it helps distinguish this schema
            # during generation. Can be combined with the OpenRosaVersioning class
            # to ensure these endpoints are explicitly included in this schema.
            api_version='openrosa',
            generator_class=OpenRosaAPISchemaGenerator,
            custom_settings={
                'TAGS': [],
                'TITLE': settings.SPECTACULAR_OPENROSA_TITLE,
                'DESCRIPTION': settings.SPECTACULAR_OPENROSA_DESCRIPTION
            },
        ),
        name='schema-openrosa',
    ),
    path(
        'api/openrosa/docs/',
        ExtendedSwaggerUIView.as_view(url_name='schema-openrosa'),
        name='swagger-ui-openrosa',
    ),
    # https://github.com/stochastic-technologies/django-loginas
    path('admin/', include('loginas.urls')),
    # Disable admin login form
    re_path(r'^admin/', admin.site.urls),
    path('', include('kobo.apps.accounts.mfa.urls')),
    *[
        path(route, RedirectView.as_view(url=url, permanent=False), name=name)
        for name, (route, url) in ALLAUTH_PAGE_REDIRECTS.items()
    ],
    path(
        'accounts/social/provisioning/',
        SocialAccountProvisioningHTMLView.as_view(),
        name='socialaccount_provisioning',
    ),
    path(
        'accounts/',
        include(ALLAUTH_URL_PATTERNS),
    ),
    path('api/v2/allauth/', include((ALLAUTH_HEADLESS_URL_PATTERNS, 'headless'))),
    re_path(
        r'^accounts/register/?',
        RedirectView.as_view(url='/accounts/signup/', permanent=False),
    ),
    path('', include('kpi.urls')),
    path('', include('kobo.apps.openrosa.apps.main.urls')),
    path(
        'markdownx/markdownify/',
        user_passes_test(lambda u: u.is_superuser)(MarkdownifyView.as_view()),
        name='markdownx_markdownify',
    ),
    path('markdownx-uploader/', include('kobo.apps.markdownx_uploader.urls')),
    path('help/', include('kobo.apps.help.urls')),
]

if settings.ENABLE_METRICS:
    urlpatterns.append(
        path('', include('django_prometheus.urls')),
    )


def render404(request: HttpRequest, exception):
    if is_request_for_html(request):
        return render_error_page(request, 404)
    # fall back to a basic JSON response if a data route is being requested
    return HttpResponse('Resource not found (404)', status=status.HTTP_404_NOT_FOUND)


def render500(request: HttpRequest):
    if is_request_for_html(request):
        return render_500_page(request)
    # fall back to the DRF 500 handler if a data route is being requested
    return server_error(request)


# override the django error page handlers with our own
handler404 = render404
handler500 = render500
