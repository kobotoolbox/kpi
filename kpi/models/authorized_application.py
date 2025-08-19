# coding: utf-8
import math
from functools import partial
from secrets import token_urlsafe

from django.contrib.auth.models import AnonymousUser
from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.translation import gettext_lazy as t
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication

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


class ApplicationTokenAuthentication(TokenAuthentication):
    model = AuthorizedApplication

    def authenticate_credentials(self, key):
        """
        Mostly duplicated from TokenAuthentication, except that we return
        an AnonymousUser

        We also do not create an AuditLog here because we only want to do so for
        certain endpoints, and only after we get the user being accessed
        """
        try:
            token = self.model.objects.get(key=key)
        except self.model.DoesNotExist:
            raise exceptions.AuthenticationFailed(t('Invalid token.'))
        return AnonymousUser(), token
