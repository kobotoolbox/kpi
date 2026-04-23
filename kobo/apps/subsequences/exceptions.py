class AnalysisQuestionNotFound(Exception):
    """
    Raised when the uuid for automatic qual analysis is not found in the manual params
    """

    pass


class AnalysisQuestionIncorrectlyConfigured(Exception):
    """
    Raised when the question corresponding to the uuid for automatic qual analysis
    is incorrectly configured in the manual params
    """
    pass


class AudioTooLongError(Exception):
    """
    Audio file is too long for the specified speech service
    """

    pass


class GoogleCloudStorageBucketNotFound(Exception):

    pass


class SubsequenceDeletionError(Exception):
    """Raised when attempting to delete a value that doesn't exist."""

    pass


class DependencyNotFound(Exception):
    pass


class InvalidAction(Exception):
    """
    The referenced action does not exist or was not configured for the given
    question XPath at the asset level
    """

    pass


class InvalidItem(Exception):
    """
    The referenced action does not contain a list of items
    """

    pass


class InvalidXPath(Exception):
    """
    The referenced question XPath was not configured for supplemental data at
    the asset level
    """

    pass


class ManualQualNotFound(DependencyNotFound):
    pass


class SubsequenceAcceptanceError(Exception):
    pass


class SubsequenceTimeoutError(Exception):
    pass


class SubsequenceVerificationError(Exception):
    pass


class SupplementMigrationInProgress(Exception):
    """
    Raised when submission supplement data has not yet been migrated to the
    current schema version. The long-running migration is responsible for
    the migration. Retry the operation once the migration has completed.
    """


class TranscriptionNotFound(DependencyNotFound):
    pass


class TranslationAsyncResultAvailable(Exception):
    pass
