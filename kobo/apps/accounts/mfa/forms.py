from allauth.mfa.adapter import get_adapter
from allauth.mfa.base.forms import AuthenticateForm, ReauthenticateForm
from allauth.mfa.base.internal.flows import check_rate_limit
from django import forms
from django.utils.translation import gettext_lazy as t

from .utils import get_totp_authenticator, validate_mfa_code


class MfaAuthenticateMixin:
    """
    allauth's code check, which also accepts the hashed recovery codes migrated
    from the former 2FA system
    """

    def clean_code(self):
        code = self.cleaned_data['code']
        if authenticator := validate_mfa_code(self.user, code):
            # As in allauth, for `save()`, without fetching the user again
            authenticator.user = self.user
            self.authenticator = authenticator
            return code

        if totp := get_totp_authenticator(self.user):
            # Like allauth, report the failure against the main authenticator
            self._emit_authentication_failed(totp)
        raise get_adapter().validation_error('incorrect_code')


class MfaAuthenticateForm(MfaAuthenticateMixin, AuthenticateForm):
    code = forms.CharField(
        label=t('Code'),
        widget=forms.TextInput(
            attrs={
                'placeholder': t('Enter token or backup code'),
                'autocomplete': 'one-time-code',
            },
        ),
    )


class MfaReauthenticateForm(MfaAuthenticateMixin, ReauthenticateForm):
    code = forms.CharField(
        label=t('Code'),
        widget=forms.TextInput(
            attrs={
                'placeholder': t('Enter token or backup code'),
                'autocomplete': 'one-time-code',
            },
        ),
    )
