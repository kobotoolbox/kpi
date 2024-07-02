# coding: utf-8
from django.urls import include, path

from .views import (
    MfaListUserMethodsView,
    MfaLoginView,
    MfaTokenView,
    MfaMethodActivationView,
)

urlpatterns = [
    path('accounts/login/mfa/', MfaTokenView.as_view(), name='mfa_token'),
    path('accounts/login/', MfaLoginView.as_view(), name='kobo_login'),
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
    path('api/v2/auth/', include('trench.urls')),
]
