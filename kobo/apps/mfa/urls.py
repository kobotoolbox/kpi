# coding: utf-8
import trench
from django.conf.urls import url
from django.urls import path, include
from trench.settings import api_settings

from .command.deactivate_mfa_method import deactivate_mfa_method_command
from .views import ActivateMfaMethodView, MfaListUserMethodsView


mfa_methods_choices = '|'.join(api_settings.MFA_METHODS.keys())

# Monkey-patch `django-trench` to avoid blocking deactivation of primary
# method.
trench.command.deactivate_mfa_method.deactivate_mfa_method_command = (
    deactivate_mfa_method_command
)

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
