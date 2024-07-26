# coding: utf-8
import constance
import pyotp
from django.conf import settings
from trench.backends.application import ApplicationMessageDispatcher

from kobo.apps.kobo_auth.shortcuts import User


class ApplicationBackend(ApplicationMessageDispatcher):
    """
    Custom class based on `django-trench` AuthenticationAppBackend class.
    It provides OTP based QR link to be scanned by like apps
    Google Authenticator and Authy.
    Unlike `django-trench`, it is also customizable number of digits,
    validity period and issuer name.
    """

    def _create_qr_link(self, user: User) -> str:
        return self._get_otp().provisioning_uri(
            getattr(user, User.USERNAME_FIELD),
            issuer_name=constance.config.MFA_ISSUER_NAME,
        )

    def _get_otp(self) -> pyotp.TOTP:
        return pyotp.TOTP(
            self._mfa_method.secret,
            digits=settings.TRENCH_AUTH['CODE_LENGTH'],
            interval=self._get_valid_window(),
        )
