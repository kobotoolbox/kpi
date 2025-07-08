from django.utils.translation import gettext_lazy as t


class AccountInactiveError(Exception):
    pass


class BuildDbQueriesAttributeError(Exception):
    pass


class BuildDbQueriesBadArgumentError(Exception):
    pass


class BuildDbQueriesNoConfirmationProvidedError(Exception):
    pass


class ConflictingAttachmentBasenameError(Exception):
    def __init__(self, message=t('Attachment with same name already exists')):
        super().__init__(message)


class ConflictingSubmissionUUIDError(Exception):
    def __init__(self, message=t('Submission with this instance ID already exists')):
        super().__init__(message)


class DuplicateInstanceError(Exception):
    def __init__(self, message=t('Duplicate Instance')):
        super().__init__(message)


class DuplicateUUIDError(Exception):
    pass


class ExceededUsageLimitError(Exception):
    pass


class FormInactiveError(Exception):
    pass


class InstanceEmptyError(Exception):
    def __init__(self, message=t('Empty instance')):
        super().__init__(message)


class InstanceInvalidUserError(Exception):
    def __init__(self, message=t('Could not determine the user')):
        super().__init__(message)


class InstanceIdMissingError(Exception):
    def __init__(self, message=t('Could not determine the instance ID')):
        super().__init__(message)


class InstanceMultipleNodeError(Exception):
    pass


class InstanceParseError(Exception):
    def __init__(self, message=t('The instance could not be parsed')):
        super().__init__(message)


class LockedSubmissionError(Exception):
    def __init__(self, message=t('Submission is currently being processed.')):
        super().__init__(message)


class MissingValidationStatusPayloadError(Exception):
    pass


class RootUUIDConstraintNotEnforced(Exception):
    """
    Raised when the unique constraint on root_uuid is missing or invalid.
    """

    pass


class TemporarilyUnavailableError(Exception):
    pass


class XLSFormError(Exception):
    pass
