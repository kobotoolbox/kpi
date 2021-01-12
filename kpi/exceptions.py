# coding: utf-8
from rest_framework import exceptions
from django.utils.translation import ugettext_lazy as _


class BadPermissionsException(Exception):
    pass


class BadAssetTypeException(Exception):
    pass


class BadContentTypeException(Exception):
    pass


class BadFormatException(Exception):
    pass


class ImportAssetException(Exception):
    pass


class PairedParentException(Exception):

    def __init__(self, message='Parent is not set. Call `self.get_paired_data()` first'):
        self.message = message
        super().__init__(self.message)


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


class ObjectDeploymentDoesNotExist(exceptions.APIException):
    status_code = 400
    default_detail = _('The specified object has not been deployed')
    default_code = 'deployment_does_not_exist'
