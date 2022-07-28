# coding: utf-8
from django.conf.urls import url
from django.urls import path, include
from trench.settings import api_settings

from .views import ActivateMfaMethodView, MfaListUserMethodsView


mfa_methods_choices = '|'.join(api_settings.MFA_METHODS.keys())

urlpatterns = [
    path('mfa/user-methods/', MfaListUserMethodsView.as_view(),
         name='mfa_list_user_methods'),
    url(
        r'^(?P<method>({}))/activate/$'.format(mfa_methods_choices),
        ActivateMfaMethodView.as_view(),
        name='mfa-activate',
    ),
    path('', include('trench.urls')),
]
