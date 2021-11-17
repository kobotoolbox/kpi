# coding: utf-8
from django import forms
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError
from trench.serializers import CodeLoginSerializer
from trench.utils import (
    get_mfa_model,
    user_token_generator,
)


class MFALoginForm(AuthenticationForm):

    def __init__(self, request=None, *args, **kwargs):
        self.ephemeral_token_cache = None
        super().__init__(*args, **kwargs)

    def clean(self):
        username = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')

        if username is not None and password:
            self.user_cache = authenticate(
                self.request, username=username, password=password
            )
            if self.user_cache is None:
                raise self.get_invalid_login_error()
            else:
                self.confirm_login_allowed(self.user_cache)
                auth_method = get_mfa_model().objects.filter(
                    is_primary=True, is_active=True, user=self.user_cache
                ).first()
                if auth_method:
                    self.ephemeral_token_cache = (
                        user_token_generator.make_token(self.user_cache)
                    )

        return self.cleaned_data

    def get_ephemeral_token(self):
        return self.ephemeral_token_cache


class MFATokenForm(forms.Form):
    """
    Base class for authenticating users. Extend this to get a form that accepts
    username/password logins.
    """
    code = forms.CharField(
        label=_("Insert your MFA code"),
        strip=True,
        required=True,
    )
    ephemeral_token = forms.CharField(
        required=True,
        widget=forms.HiddenInput(),
    )

    error_messages = {
        'invalid_code': _(
            "Invalid MFA code."
        )
    }

    def __init__(self, request=None, *args, **kwargs):
        self.user_cache = None
        super().__init__(*args, **kwargs)

    def clean(self):
        code_login_serializer = CodeLoginSerializer(data=self.cleaned_data)
        if not code_login_serializer.is_valid():
            raise self.get_invalid_mfa_error()

        self.user_cache = code_login_serializer.user
        self.user_cache.backend = settings.AUTHENTICATION_BACKENDS[0]

        return self.cleaned_data

    def get_invalid_mfa_error(self):
        return forms.ValidationError(
            self.error_messages['invalid_code'],
            code='invalid_code',
        )

    def get_user(self):
        return self.user_cache
