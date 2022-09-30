import jwt
from django.conf import settings
from django.contrib.auth.models import User
from django.core.signing import BadSignature
from django.utils.translation import ugettext as _
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import exceptions
from rest_framework.authentication import (
    BaseAuthentication
)
from rest_framework.authtoken.models import Token

from kpi.utils.permissions import grant_default_model_level_perms



def get_api_token(json_web_token):
    """Get API Token from JSON Web Token"""
    # having the JWT variables here allows the values to be mocked easily as
    # oppossed to being on the global scope. At the moment they are set
    # globally mainly because there isn't a test for it
    try:
        jwt_payload = jwt.decode(
            json_web_token,
            getattr(settings, "JWT_SECRET_KEY", ""),
            algorithms=[getattr(settings, "JWT_ALGORITHM", "HS256")]
        )

        api_token = Token.objects.using("kobocat").select_related('user').get(
            key=jwt_payload.get('api-token'))
        return api_token
    except BadSignature as e:
        raise exceptions.AuthenticationFailed(_(f'Bad Signature: {e}'))
    except jwt.DecodeError as e:
        raise exceptions.AuthenticationFailed(_(f'JWT DecodeError: {e}'))
    except Token.DoesNotExist:
        raise exceptions.AuthenticationFailed(_(f'No Token retrieved.'))


class JWTAuthentication(BaseAuthentication):
    model = Token

    def authenticate(self, request):
        cookie_jwt = request.COOKIES.get(settings.KPI_COOKIE_NAME)
        if cookie_jwt:
            api_token = get_api_token(cookie_jwt)
            user, created = User.objects.using('default').get_or_create(
                username=api_token.user.username)

            if created:
                grant_default_model_level_perms(user)

            if getattr(api_token, "user"):
                return user, None
        else:
            return None


