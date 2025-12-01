from allauth.mfa.adapter import get_adapter
from allauth.mfa.base.forms import AuthenticateForm, ReauthenticateForm

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
    pass


class MfaReauthenticateForm(MfaAuthenticateMixin, ReauthenticateForm):
    pass
