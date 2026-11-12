# coding: utf-8
from allauth.headless.constants import Client
from django.urls import path

from ..views import (
    HeadlessMfaAuthenticateView,
    HeadlessMfaLoginView,
    MfaAuthenticateView,
    MfaLoginView,
)
from .views import (
    MfaListUserMethodsView,
    MfaMethodActivationView,
    MfaMethodConfirmView,
    MfaMethodDeactivateView,
    MfaMethodRegenerateCodesView,
)

urlpatterns = [
    path('accounts/login/', MfaLoginView.as_view(), name='kobo_login'),
    path(
        'accounts/2fa/authenticate/',
        MfaAuthenticateView.as_view(),
        name='kobo_mfa_auth',
    ),
    path(
        'api/v2/allauth/browser/v1/auth/login',
        HeadlessMfaLoginView.as_api_view(client=Client.BROWSER),
        name='kobo_headless_login_browser',
    ),
    path(
        'api/v2/allauth/browser/v1/auth/2fa/authenticate',
        HeadlessMfaAuthenticateView.as_api_view(client=Client.BROWSER),
        name='kobo_headless_mfa_auth',
    ),
    path(
        'api/v2/allauth/app/v1/auth/login',
        HeadlessMfaLoginView.as_api_view(client=Client.APP),
        name='kobo_headless_login_browser',
    ),
    path(
        'api/v2/allauth/app/v1/auth/2fa/authenticate',
        HeadlessMfaAuthenticateView.as_api_view(client=Client.APP),
        name='kobo_headless_mfa_auth',
    ),
    path(
        'api/v2/auth/mfa/user-methods/',
        MfaListUserMethodsView.as_view(),
        name='mfa_list_user_methods',
    ),
    path(
        'api/v2/auth/<str:method>/activate/',
        MfaMethodActivationView.as_view(),
        name='mfa-activate',
    ),
    path(
        'api/v2/auth/<str:method>/activate/confirm/',
        MfaMethodConfirmView.as_view(),
        name='mfa-confirm',
    ),
    path(
        'api/v2/auth/<str:method>/deactivate/',
        MfaMethodDeactivateView.as_view(),
        name='mfa-deactivate',
    ),
    path(
        'api/v2/auth/<str:method>/codes/regenerate/',
        MfaMethodRegenerateCodesView.as_view(),
        name='mfa-regenerate',
    ),
]
