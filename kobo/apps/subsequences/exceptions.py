class AudioTooLongError(Exception):
    """Audio file is too long for specified speech service"""


class SubsequenceTimeoutError(Exception):
    pass


class TranscriptionResultsNotFound(Exception):
    """
    No results returned by specified transcription service
    """


class TranslationAsyncResultAvailable(Exception):
    pass


class TranslationResultsNotFound(Exception):
    pass
