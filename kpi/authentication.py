# coding: utf-8
import os

import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.utils.translation import gettext as t
from django_digest import HttpDigestAuthenticator
from rest_framework.authentication import (
    BaseAuthentication,
    BasicAuthentication as DRFBasicAuthentication,
    TokenAuthentication as DRFTokenAuthentication,
    get_authorization_header,
)
from rest_framework.exceptions import AuthenticationFailed

from kpi.mixins.mfa import MFABlockerMixin


class BasicAuthentication(MFABlockerMixin, DRFBasicAuthentication):
    """
    Extend DRF class to support MFA.

    Basic authentication should be deactivated if user has activated MFA
    on their account (unless it has been add to `settings.MFA_SUPPORTED_AUTH_CLASSES`)
    """
    verbose_name = 'Basic authentication'

    def authenticate_credentials(self, userid, password, request=None):
        user, _ = super().authenticate_credentials(
            userid=userid, password=password, request=request
        )
        self.validate_mfa_not_active(user)
        return user, _


class DigestAuthentication(MFABlockerMixin, BaseAuthentication):

    verbose_name = 'Digest authentication'

    def __init__(self):
        self.authenticator = HttpDigestAuthenticator()

    def authenticate(self, request):

        auth = get_authorization_header(request).split()
        if not auth or auth[0].lower() != b'digest':
            return None

        if self.authenticator.authenticate(request):

            # If user provided correct credentials but their account is
            # disabled, return a 401
            if not request.user.is_active:
                raise AuthenticationFailed()

            self.validate_mfa_not_active(request.user)

            return request.user, None
        else:
            raise AuthenticationFailed(t('Invalid username/password'))

    def authenticate_header(self, request):
        response = self.build_challenge_response()
        return response['WWW-Authenticate']

    def build_challenge_response(self):
        return self.authenticator.build_challenge_response()


class EnketoCookieAuthentication(BaseAuthentication):
    """
    Authenticate users with Enketo Express cookie content

    Enketo Express caches credentials in a cookie (see `settings.ENKETO_AUTH_COOKIE_NAME`)
    as an encoded string. JWT is used to encode/decode the content with HS256
    algorithm.
    """
    verbose_name = 'Enketo Express Cookie authentication'

    def authenticate(self, request):
        """
        Read Enketo Express cookie and, if it is valid, get the user from it.
        """
        ee_auth_cookie = request.COOKIES.get(settings.ENKETO_AUTH_COOKIE_NAME)
        if not ee_auth_cookie:
            return None

        try:
            payload = jwt.decode(
                ee_auth_cookie,
                os.getenv('ENKETO_ENCRYPTION_KEY'),
                algorithms=['HS256'],
            )
        except (jwt.DecodeError, jwt.InvalidSignatureError):
            raise AuthenticationFailed('Invalid token.')

        try:
            user = User.objects.get(username=payload['user'])
        except User.DoesNotExist:
            raise AuthenticationFailed(t('Invalid username.'))

        if not user.is_active:
            raise AuthenticationFailed(t('User inactive or deleted.'))

        # return a tuple like other authentication classes
        return user, None

    @staticmethod
    def get_encoded_credentials(request) -> str:
        """
        Return an encoded string representing credentials Enketo Express
        would need to authenticate user against KPI API with this class.
        """
        # Django middleware reads the session id directly from the cookie, but
        # the session could have not been created yet.Here, we want to be sure
        # that the session exists before setting the cookie for Enketo
        if not request.session.session_key:
            request.session.create()

        payload = {
            'user': request.user.username,
            'pass': request.session.session_key,
        }

        # Encode payload as Enketo Express would do.
        # https://github.com/enketo/enketo-express/blob/926f905d75488d167aa1b450d93d2ac903be826f/app/controllers/authentication-controller.js#L79-L82
        return jwt.encode(
            payload, os.getenv('ENKETO_ENCRYPTION_KEY'), algorithm='HS256'
        )


class TokenAuthentication(MFABlockerMixin, DRFTokenAuthentication):
    """
    Extend DRF class to support MFA.

    Token authentication should be deactivated if user has activated MFA
    on their account (unless it has been add to `settings.MFA_SUPPORTED_AUTH_CLASSES`)
    """
    verbose_name = 'Token authentication'

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key=key)
        self.validate_mfa_not_active(user)
        return user, token
