from .automatic_google_transcription import AutomaticGoogleTranscriptionAction
from .automatic_google_translation import AutomaticGoogleTranslationAction
from .manual_transcription import ManualTranscriptionAction
from .manual_translation import ManualTranslationAction

# TODO, what about using a loader for every class in "actions" folder (except base.py)?
ACTIONS = (
    AutomaticGoogleTranscriptionAction,
    AutomaticGoogleTranslationAction,
    ManualTranscriptionAction,
    ManualTranslationAction,
)

TRANSCRIPTION_ACTIONS = (
    AutomaticGoogleTranscriptionAction,
    ManualTranscriptionAction,
)

ACTION_IDS_TO_CLASSES = {a.ID: a for a in ACTIONS}

TRANSCRIPTION_ACTION_IDS_TO_CLASSES = {a.ID: a for a in TRANSCRIPTION_ACTIONS}
