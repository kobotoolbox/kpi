# coding: utf-8
from django import forms
from django.conf import settings
from django.contrib.auth.forms import AuthenticationForm
from django.utils.translation import gettext_lazy as t
from trench.serializers import CodeLoginSerializer
from trench.utils import (
    get_mfa_model,
    user_token_generator,
)


class MFALoginForm(AuthenticationForm):
    """
    Authenticating users.
    If 2FA is activated, first step (of two) of the login process.
    """

    def __init__(self, request=None, *args, **kwargs):
        self.ephemeral_token_cache = None
        super().__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super().clean()
        # `super().clean()` initialize the object `self.user_cache` with
        # the user object retrieved from authentication (if any)
        auth_method = get_mfa_model().objects.filter(
            is_active=True, user=self.user_cache
        ).first()
        # Because we only support one 2FA method, we do not filter on
        # `is_primary` too (as django_trench does).
        # ToDo Figure out why `is_primary` is False sometimes after reactivating
        #  2FA
        if auth_method:
            self.ephemeral_token_cache = (
                user_token_generator.make_token(self.user_cache)
            )

        return cleaned_data

    def get_ephemeral_token(self):
        return self.ephemeral_token_cache


class MFATokenForm(forms.Form):
    """
    Validate 2FA token.
    Second (and last) step of login process when MFA is activated.
    """
    code = forms.CharField(
        label='',
        strip=True,
        required=True,
        widget=forms.TextInput(
            attrs={
                'placeholder': t(
                    'Enter the ##token length##-character token'
                ).replace('##token length##', str(settings.TRENCH_AUTH['CODE_LENGTH']))
            }
        )
    )
    ephemeral_token = forms.CharField(
        required=True,
        widget=forms.HiddenInput(),
    )

    error_messages = {
        'invalid_code': t(
            'Your token is invalid'
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
        # When login is successful, `django.contrib.auth.login()` expects the
        # authentication backend class to be attached to user object.
        # See https://github.com/django/django/blob/b87820668e7bd519dbc05f6ee46f551858fb1d6d/django/contrib/auth/__init__.py#L111
        # Since we do not have a bullet-proof way to detect which authentication
        # class is the good one, we use the first element of the list
        self.user_cache.backend = settings.AUTHENTICATION_BACKENDS[0]

        return self.cleaned_data

    def get_invalid_mfa_error(self):
        return forms.ValidationError(
            self.error_messages['invalid_code'],
            code='invalid_code',
        )

    def get_user(self):
        return self.user_cache
