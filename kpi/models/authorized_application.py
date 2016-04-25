import datetime
from django.db import models
from django.utils.crypto import get_random_string
from django.utils.translation import ugettext_lazy as _
from django.core.validators import MinLengthValidator
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import TokenAuthentication
from rest_framework import exceptions

KEY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)'
KEY_LENGTH = 60

def _generate_random_key():
    return get_random_string(KEY_LENGTH, KEY_CHARS)

class AuthorizedApplication(models.Model):
    name = models.CharField(max_length=50)
    key = models.CharField(
        max_length=KEY_LENGTH,
        validators=[MinLengthValidator(KEY_LENGTH)],
        default=_generate_random_key
    )

    def __unicode__(self):
        return self.name


def ten_minutes_from_now():
    return datetime.datetime.now() + datetime.timedelta(minutes=10)

class OneTimeAuthenticationKey(models.Model):
    user = models.ForeignKey('auth.User')
    key = models.CharField(
        max_length=KEY_LENGTH,
        validators=[MinLengthValidator(KEY_LENGTH)],
        default=_generate_random_key
    )
    expiry = models.DateTimeField(default=ten_minutes_from_now)


class ApplicationTokenAuthentication(TokenAuthentication):
    model = AuthorizedApplication

    def authenticate_credentials(self, key):
        ''' Mostly duplicated from TokenAuthentication, except that we return
        an AnonymousUser '''
        try:
            token = self.model.objects.get(key=key)
        except self.model.DoesNotExist:
            raise exceptions.AuthenticationFailed(_('Invalid token.'))
        return (AnonymousUser(), token)
