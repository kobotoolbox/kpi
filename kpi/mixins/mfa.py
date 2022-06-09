# coding: utf-8
from django.conf import settings
from django.utils.translation import gettext
from rest_framework import exceptions

from trench.utils import get_mfa_model


class MFABlockerMixin:

    def validate_mfa_not_active(self, user: 'auth.User'):
        """
        Raise an exception if MFA is enabled for user's account.
        """

        # This condition is kind of temporary. We can activate/deactivate
        # class based on settings. Useful until we decide whether
        # TokenAuthentication should be deactivated with MFA
        # ToDo Remove the condition when kobotoolbox/kpi#3383 is released/merged
        class_path = f'{self.__module__}.{self.__class__.__name__}'
        if class_path not in settings.MFA_SUPPORTED_AUTH_CLASSES:
            if get_mfa_model().objects.filter(is_active=True, user=user).exists():
                raise exceptions.AuthenticationFailed(gettext(
                    'Multi-factor authentication is enabled for this account. '
                    f'{self.verbose_name} cannot be used.'
                ))
