# coding: utf-8
from functools import partial
import math
from secrets import token_urlsafe

from django.db import models
from django.utils.translation import ugettext_lazy as _
from django.core.validators import MinLengthValidator
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import TokenAuthentication
from rest_framework import exceptions

from kpi.utils.datetime import ten_minutes_from_now

KEY_LENGTH = 60
NUM_KEY_BYTES = math.floor(KEY_LENGTH * 3 / 4)


class AuthorizedApplication(models.Model):
    name = models.CharField(max_length=50)
    key = models.CharField(
        max_length=KEY_LENGTH,
        validators=[MinLengthValidator(KEY_LENGTH)],
        default=partial(token_urlsafe, nbytes=NUM_KEY_BYTES)
    )

    def __str__(self):
        return self.name


class OneTimeAuthenticationKey(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    key = models.CharField(
        max_length=KEY_LENGTH,
        validators=[MinLengthValidator(KEY_LENGTH)],
        default=partial(token_urlsafe, nbytes=NUM_KEY_BYTES)
    )
    expiry = models.DateTimeField(default=ten_minutes_from_now)


class ApplicationTokenAuthentication(TokenAuthentication):
    model = AuthorizedApplication

    def authenticate_credentials(self, key):
        """ Mostly duplicated from TokenAuthentication, except that we return
        an AnonymousUser """
        try:
            token = self.model.objects.get(key=key)
        except self.model.DoesNotExist:
            raise exceptions.AuthenticationFailed(_('Invalid token.'))
        return AnonymousUser(), token
