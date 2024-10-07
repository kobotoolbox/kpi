# coding: utf-8
from django.conf import settings
from django.utils.translation import gettext_lazy as t
from rest_framework import exceptions, status


class AbstractMethodError(NotImplementedError):

    def __init__(self, *args, **kwargs):
        super().__init__(
            'This method should be implemented in subclasses', *args, **kwargs
        )


class AbstractPropertyError(NotImplementedError):

    def __init__(self, *args, **kwargs):
        super().__init__(
            'This property should be implemented in subclasses', *args, **kwargs
        )


class AssetAdjustContentError(Exception):
    pass


class AttachmentNotFoundException(Exception):
    pass


class BadAssetTypeException(Exception):
    pass


class BadContentTypeException(Exception):
    pass


class BadFormatException(Exception):
    pass


class BadPermissionsException(Exception):
    pass


class BulkUpdateSubmissionsClientException(exceptions.ValidationError):
    # This is message should be overridden with something more specific
    default_detail = t('Invalid payload for bulk updating of submissions')
    default_code = 'bulk_update_submissions_client_error'


class DeploymentDataException(Exception):

    def __init__(self, *args, **kwargs):
        super().__init__(
            'Cannot alter `_deployment_data` directly', *args, **kwargs
        )


class DeploymentNotFound(Exception):

    def __init__(
        self, message=t('Must call `asset.connect_deployment()` first')
    ):
        super().__init__(message)


class DTDForbiddenException(Exception):
    """
    Exception to be used when DTDs are forbidden while parsing XML using the
    LXML library
    """

    def __init__(self, message=t('XML contains forbidden DTDs')):
        self.message = message
        super().__init__(self.message)


class EntitiesForbiddenException(Exception):
    """
    Exception to be used when Entities are forbidden while parsing XML
    using the LXML library
    """

    def __int__(self, message=t('XML contains forbidden entities')):
        self.message = message
        super().__init__(self.message)


class FFMpegException(Exception):
    pass


class ImportAssetException(Exception):
    pass


class InvalidPasswordAPIException(exceptions.APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = t(
        'Your access is restricted. Please reclaim your access by '
        'changing your password at '
        '##koboform_url##/accounts/password/reset/.'
    ).replace('##koboform_url##', settings.KOBOFORM_URL)
    default_code = 'invalid_password'


class InvalidSearchException(exceptions.APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = t('Invalid search. Please try again')
    default_code = 'invalid_search'


class InvalidXFormException(Exception):
    def __init__(self, message=t('Deployment links to an unexpected KoboCAT XForm')):
        super().__init__(message)


class InvalidXPathException(Exception):
    pass


class KobocatCommunicationError(Exception):

    def __init__(
        self, message='Could not communicate with KoBoCAT', *args, **kwargs
    ):
        super().__init__(message, *args, **kwargs)


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
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = t('An error occurred trying to duplicate the submission')
    default_code = 'submission_duplication_error'


class KobocatProfileException(Exception):
    pass


class MissingXFormException(Exception):
    pass


class NotSupportedFormatException(Exception):
    pass


class ObjectDeploymentDoesNotExist(exceptions.APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = t('The specified object has not been deployed')
    default_code = 'deployment_does_not_exist'


class PairedDataException(Exception):
    pass


class QueryParserBadSyntax(InvalidSearchException):
    default_detail = t('Bad syntax')
    default_code = 'query_parser_bad_syntax'


class QueryParserNotSupportedFieldLookup(InvalidSearchException):
    default_detail = t('Not supported field lookup')
    default_code = 'not_supported_field_lookup'


class ReadOnlyModelError(Exception):

    def __init__(self, msg='This model is read only', *args, **kwargs):
        super().__init__(msg, *args, **kwargs)


class SearchQueryTooShortException(InvalidSearchException):
    default_detail = t('Your query is too short')
    default_code = 'query_too_short'


class SubmissionIntegrityError(Exception):
    pass


class SubmissionNotFoundException(Exception):
    pass


class XPathNotFoundException(Exception):
    pass


class XlsFormatException(Exception):
    pass
