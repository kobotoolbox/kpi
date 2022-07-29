# coding: utf-8
import trench
from django.urls import path, include

from .command.deactivate_mfa_method import deactivate_mfa_method_command
from .views import MfaListUserMethodsView

# Monkey-patch `django-trench` to avoid blocking deactivation of primary
# method.
trench.command.deactivate_mfa_method.deactivate_mfa_method_command = (
    deactivate_mfa_method_command
)

urlpatterns = [
    path('mfa/user-methods/', MfaListUserMethodsView.as_view(),
         name='mfa_list_user_methods'),
    path('', include('trench.urls')),
]
