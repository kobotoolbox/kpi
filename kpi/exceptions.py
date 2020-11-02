# coding: utf-8
from django.utils.translation import ugettext_lazy as _
from rest_framework import exceptions


class BadPermissionsException(Exception):
    pass


class BadAssetTypeException(Exception):
    pass


class BadFormatException(Exception):
    pass


class ImportAssetException(Exception):
    pass


class KobocatProfileException(Exception):
    pass


class InvalidSearchException(exceptions.APIException):
    status_code = 400
    default_detail = _('Invalid search. Please try again')
    default_code = 'invalid_search'


class SearchQueryTooShortException(InvalidSearchException):
    default_detail = _('Your query is too short')
    default_code = 'query_too_short'


class KobocatDeploymentException(exceptions.APIException):
    def __init__(self, *args, **kwargs):
        if 'response' in kwargs:
            self.response = kwargs.pop('response')
        super().__init__(*args, **kwargs)

    @property
    def invalid_form_id(self):
        # We recognize certain KC API responses as indications of an
        # invalid form id:
        invalid_form_id_responses = (
            'Form with this id or SMS-keyword already exists.',
            'In strict mode, the XForm ID must be a valid slug and '
            'contain no spaces.',
        )
        return self.detail in invalid_form_id_responses
