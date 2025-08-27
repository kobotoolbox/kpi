from typing import Type, TypeAlias, Union

from .integrations.google.google_transcribe import GoogleTranscriptionService
from .integrations.google.google_translate import GoogleTranslationService

# A list of possible NLP external services
NLPExternalServiceClass: TypeAlias = Union[
    Type[GoogleTranscriptionService],
    Type[GoogleTranslationService],
]
