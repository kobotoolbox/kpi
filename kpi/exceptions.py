# coding: utf-8
from django.utils.translation import ugettext_lazy as _
from rest_framework import exceptions


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


class KobocatDuplicateSubmissionException(exceptions.APIException):
    status_code = 500
    default_detail = _('An error occurred trying to duplicate the submission.')
    default_code = 'submission_duplication_error'


class KobocatBulkUpdateSubmissionsException(exceptions.APIException):
    status_code = 500
    default_detail = _('An error occurred trying to bulk update the submissions.')
    default_code = 'bulk_update_submissions_error'


class KobocatBulkUpdateSubmissionsClientException(exceptions.ValidationError):
    # This is message should be overridden with something more specific
    default_detail = _('Invalid payload for bulk updating of submissions')
    default_code = 'bulk_update_submissions_client_error'


class ObjectDeploymentDoesNotExist(exceptions.APIException):
    status_code = 400
    default_detail = _('The specified object has not been deployed')
    default_code = 'deployment_does_not_exist'
