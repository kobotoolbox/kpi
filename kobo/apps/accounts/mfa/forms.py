from allauth.mfa.adapter import get_adapter
from allauth.mfa.base.forms import AuthenticateForm, ReauthenticateForm
from django import forms
from django.utils.translation import gettext_lazy as t

from .serializers import MfaCodeSerializer


class MfaAuthenticateMixin:

    def clean_code(self):
        code = self.cleaned_data['code']
        serializer = MfaCodeSerializer(
            data={'code': code}, context={'user': self.user, 'method': 'app'}
        )

        if serializer.is_valid():
            self.authenticator = serializer.authenticator
            return code

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
