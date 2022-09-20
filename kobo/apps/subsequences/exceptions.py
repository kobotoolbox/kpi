class SubsequenceTimeoutError(Exception):
    pass


class AudioTooLongError(Exception):
    """Audio file is too long for specified speech service"""