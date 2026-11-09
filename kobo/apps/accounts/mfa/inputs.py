from allauth.headless.mfa.inputs import AuthenticateInput, ReauthenticateInput

from .forms import MfaAuthenticateMixin


class MfaAuthenticateInput(MfaAuthenticateMixin, AuthenticateInput):
    """
    Headless counterpart of `MfaAuthenticateForm`: allauth's headless views use
    their own inputs, so `MFA_FORMS` does not reach them
    """


class MfaReauthenticateInput(MfaAuthenticateMixin, ReauthenticateInput):
    """
    Headless counterpart of `MfaReauthenticateForm`
    """
