from typing import Any, Type, TypeAlias, Union

from .integrations.google.google_transcribe import GoogleTranscriptionService
from .integrations.google.google_translate import GoogleTranslationService

# A list of possible NLP external services
NLPExternalServiceClass: TypeAlias = Union[
    Type[GoogleTranscriptionService],
    Type[GoogleTranslationService],
]

# result of transform_data_for_output
SimplifiedOutputCandidatesByColumnKey: TypeAlias = dict[str | tuple, dict[str, Any]]

# QA question configs
