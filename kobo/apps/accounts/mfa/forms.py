from allauth.mfa.base.forms import AuthenticateForm
from django import forms
from django.conf import settings
from django.utils.translation import gettext_lazy as t
from trench.command.authenticate_second_factor import (
    authenticate_second_step_command,
)
from trench.exceptions import MFAValidationError
from trench.serializers import CodeLoginSerializer
from trench.utils import get_mfa_model, user_token_generator


class MfaAuthenticateForm(AuthenticateForm):
    pass
