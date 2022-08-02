# coding: utf-8
import trench
from django.urls import path, include

from .command import (
    create_mfa_method_command,
    deactivate_mfa_method_command,
)
from .views import MfaListUserMethodsView


# Monkey-patch `django-trench` to avoid duplicating lots of code in views,
# and serializers just for few line changes.

# Changed behaviours:
# 1. Stop blocking deactivation of primary method
trench.command.deactivate_mfa_method.deactivate_mfa_method_command = (
    deactivate_mfa_method_command
)
# 2. Resetting secret on reactivation
trench.command.create_mfa_method.create_mfa_method_command = (
    create_mfa_method_command
)


urlpatterns = [
    path('mfa/user-methods/', MfaListUserMethodsView.as_view(),
         name='mfa_list_user_methods'),
    path('', include('trench.urls')),
]
