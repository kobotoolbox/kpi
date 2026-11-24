from ..integrations.google.google_transcribe import GoogleTranscriptionService
from ..type_aliases import NLPExternalServiceClass
from .automatic_transcription import BaseAutomaticTranscriptionAction


class AutomaticGoogleTranscriptionAction(BaseAutomaticTranscriptionAction):

    ID = 'automatic_google_transcription'
    SERVICE_CODE = GoogleTranscriptionService.SERVICE_CODE

    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        return GoogleTranscriptionService

    @property
    def chunk_hard_limit_seconds(self) -> float:
        # `DEFAULT_SPEECH_MODEL`, the model this engine falls back to, refuses
        # audio longer than an hour, well under the 479 min of
        # `ASYNC_MAX_LENGTH` that the batch API itself allows. Five minutes
        # under the model's limit leaves a margin for a recording that turns
        # out slightly longer than ffprobe reported
        return 55 * 60
