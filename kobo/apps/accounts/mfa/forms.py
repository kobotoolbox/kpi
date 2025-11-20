from allauth.mfa.adapter import get_adapter
from allauth.mfa.base.forms import AuthenticateForm, ReauthenticateForm
from allauth.mfa.base.internal.flows import check_rate_limit
from allauth.mfa.models import Authenticator
from django.contrib.auth.hashers import check_password


class MfaAuthenticateMixin:

    def clean_code(self):
        clear_rl = check_rate_limit(self.user)
        code = self.cleaned_data['code']
        for auth in Authenticator.objects.filter(user=self.user).exclude(
            # WebAuthn cannot validate manual codes.
            type=Authenticator.Type.WEBAUTHN
        ):
            if auth.wrap().validate_code(code):
                self.authenticator = auth
                clear_rl()
                return code
            if auth.type == Authenticator.Type.RECOVERY_CODES:
                hashed_code = self.validate_migrated_codes(code, auth.wrap())
                if hashed_code is not None:
                    self.authenticator = auth
                    clear_rl()
                    return code

        raise get_adapter().validation_error('incorrect_code')

    def validate_migrated_codes(self, input_code, recovery_codes):
        codes = recovery_codes._get_migrated_codes()
        if codes is None:
            return
        if not codes[0].startswith('pbkdf2_sha256$'):
            return
        # if codes are sha256 hashes do the recovery codes logic
        for idx, hashed_code in enumerate(codes):
            if check_password(input_code, hashed_code):
                recovery_codes.validate_code(hashed_code)
                return hashed_code


class MfaAuthenticateForm(MfaAuthenticateMixin, AuthenticateForm):
    pass


class MfaReauthenticateForm(MfaAuthenticateMixin, ReauthenticateForm):
    pass
