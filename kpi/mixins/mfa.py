# coding: utf-8
from django.utils.translation import gettext
from rest_framework import exceptions

from trench.utils import get_mfa_model


class MFABlockerMixin:

    def validate_mfa_not_active(self, user: 'auth.User'):
        """
        Raise an exception if MFA is enabled for user's account.
        """
        if get_mfa_model().objects.filter(
                is_primary=True, is_active=True, user=user
        ).exists():
            raise exceptions.AuthenticationFailed(gettext(
                'Multi-factor authentication is enabled for this account. '
                f'{self.verbose_name} cannot be used.'
            ))
