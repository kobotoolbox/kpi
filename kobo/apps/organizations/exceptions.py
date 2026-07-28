from django.utils.translation import gettext_lazy as t
from rest_framework import status
from rest_framework.exceptions import APIException


class InvalidMembershipRequest(APIException):
    """
    Reject an invite or member request with a client-displayable message.

    Deliberately not a `ValidationError`: DRF re-keys errors raised from
    `validate_<field>()` under the field name (`{"role": [...]}`), which the
    frontend cannot display generically. An `APIException` is not re-keyed, so
    the message reaches the client as a plain `detail` string (DEV-1218).
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = t('Invalid request')


class NotMultiMemberOrganizationException(Exception):
    pass
