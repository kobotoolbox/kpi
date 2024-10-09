class BuildDbQueriesAttributeError(Exception):
    pass


class BuildDbQueriesBadArgumentError(Exception):
    pass


class BuildDbQueriesNoConfirmationProvidedError(Exception):
    pass


class DuplicateUUIDError(Exception):
    pass


class FormInactiveError(Exception):
    pass


class MissingValidationStatusPayloadError(Exception):
    pass


class TemporarilyUnavailableError(Exception):
    pass
