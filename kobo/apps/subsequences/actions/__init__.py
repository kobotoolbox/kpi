from .automatic_google_transcription import AutomaticGoogleTranscriptionAction
from .automatic_transcription import AutomaticTranscriptionAction
from .manual_transcription import ManualTranscriptionAction
from .manual_translation import ManualTranslationAction

# TODO, what about using a loader for every class in "actions" folder (except base.py)?
ACTIONS = (
    AutomaticGoogleTranscriptionAction,
    AutomaticTranscriptionAction,
    ManualTranscriptionAction,
    ManualTranslationAction,
)
ACTION_IDS_TO_CLASSES = {a.ID: a for a in ACTIONS}
