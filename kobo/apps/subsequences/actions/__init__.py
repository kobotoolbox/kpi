from .automated_google_transcription import AutomatedGoogleTranscriptionAction
from .automated_google_translation import AutomatedGoogleTranslationAction
from .manual_transcription import ManualTranscriptionAction
from .manual_translation import ManualTranslationAction

# TODO, what about using a loader for every class in "actions" folder (except base.py)?
ACTIONS = (
    AutomatedGoogleTranscriptionAction,
    AutomatedGoogleTranslationAction,
    ManualTranscriptionAction,
    ManualTranslationAction,
)

TRANSCRIPTION_ACTIONS = (
    AutomatedGoogleTranscriptionAction,
    ManualTranscriptionAction,
)

ACTION_IDS_TO_CLASSES = {a.ID: a for a in ACTIONS}

TRANSCRIPTION_ACTION_IDS_TO_CLASSES = {a.ID: a for a in TRANSCRIPTION_ACTIONS}
