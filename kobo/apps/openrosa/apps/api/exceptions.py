# coding: utf-8
from django.utils.translation import gettext_lazy as t
from rest_framework.exceptions import APIException
from rest_framework.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_405_METHOD_NOT_ALLOWED,
)


class LegacyAPIException(APIException):
    status_code = HTTP_405_METHOD_NOT_ALLOWED
    default_detail = t('This is not supported by the legacy API anymore')
    default_code = 'legacy_api_exception'


class NoConfirmationProvidedAPIException(APIException):

    status_code = HTTP_400_BAD_REQUEST
    default_detail = t('No confirmation provided')
    default_code = 'no_confirmation_provided'
