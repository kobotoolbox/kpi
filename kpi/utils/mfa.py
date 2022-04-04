# coding: utf-8
import constance
import pyotp
from django.conf import settings
from django.contrib.auth.models import User
from trench.backends import AbstractMessageDispatcher
from trench.settings import api_settings


class ApplicationBackend(AbstractMessageDispatcher):
    """
    Custom class based on `django-trench` AuthenticationAppBackend class.
    It provides OTP based QR link to be scanned by like apps
    Google Authenticator and Authy.
    Unlike `django-trench`, it is also customizable number of digits,
    validity period and issuer name.
    """

    def create_code(self) -> str:
        return self._get_topt().now()

    def dispatch_message(self, *args, **kwargs) -> dict:
        totp = self._get_topt()
        return {
            'details': totp.provisioning_uri(
                getattr(self.user, User.USERNAME_FIELD),
                issuer_name=constance.config.MFA_ISSUER_NAME,
            )
        }

    def _get_topt(self) -> pyotp.TOTP:
        validity_period = (
            self.conf.get('VALIDITY_PERIOD')
            or api_settings.DEFAULT_VALIDITY_PERIOD
        )
        return pyotp.TOTP(
            self.obj.secret,
            digits=settings.TRENCH_AUTH['CODE_LENGTH'],
            interval=validity_period,
        )
