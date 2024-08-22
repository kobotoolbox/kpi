class BuildDbQueriesAttributeError(Exception):
    pass


class BuildDbQueriesBadArgumentError(Exception):
    pass


class BuildDbQueriesNoConfirmationProvidedError(Exception):
    pass


class ConflictingXMLHashInstanceError(Exception):
    pass


class DuplicateInstanceError(Exception):
    def __init__(self, message='Duplicate Instance'):
        super().__init__(message)


class DuplicateUUIDError(Exception):
    pass


class FormInactiveError(Exception):
    pass


class InstanceEmptyError(Exception):
    def __init__(self, message='Empty instance'):
        super().__init__(message)


class InstanceInvalidUserError(Exception):
    def __init__(self, message='Could not determine the user'):
        super().__init__(message)


class InstanceMultipleNodeError(Exception):
    pass


class InstanceParseError(Exception):
    def __init__(self, message='The instance could not be parsed'):
        super().__init__(message)


class MissingValidationStatusPayloadError(Exception):
    pass


class TemporarilyUnavailableError(Exception):
    pass


class XLSFormError(Exception):
    pass
