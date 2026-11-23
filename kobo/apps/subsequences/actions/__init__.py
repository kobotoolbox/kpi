from .automatic_bedrock_qual import AutomaticBedrockQual
from .automatic_google_transcription import AutomaticGoogleTranscriptionAction
from .automatic_google_translation import AutomaticGoogleTranslationAction
from .manual_qual import ManualQualAction
from .manual_transcription import ManualTranscriptionAction
from .manual_translation import ManualTranslationAction
from .mixins import TranscriptionActionMixin, TranslationActionMixin

# TODO, what about using a loader for every class in "actions" folder (except base.py)?

ACTIONS = (
    AutomaticGoogleTranscriptionAction,
    AutomaticGoogleTranslationAction,
    ManualTranscriptionAction,
    ManualTranslationAction,
    ManualQualAction,
    AutomaticBedrockQual,
)

ACTION_IDS_TO_CLASSES = {a.ID: a for a in ACTIONS}

ACTION_IDS = [a.ID for a in ACTIONS]

# Service `code` (see `kobo.apps.languages`) → ID of the action that calls it,
# e.g. `{'goog': 'automatic_google_transcription'}`
TRANSCRIPTION_ACTION_IDS_BY_SERVICE_CODE = {
    a.SERVICE_CODE: a.ID
    for a in ACTIONS
    if issubclass(a, TranscriptionActionMixin) and hasattr(a, 'SERVICE_CODE')
}
TRANSLATION_ACTION_IDS_BY_SERVICE_CODE = {
    a.SERVICE_CODE: a.ID
    for a in ACTIONS
    if issubclass(a, TranslationActionMixin) and hasattr(a, 'SERVICE_CODE')
}
