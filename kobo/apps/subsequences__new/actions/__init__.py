from .manual_transcription import ManualTranscriptionAction

# TODO, what about using a loader for every class in "actions" folder (except base.py)?
ACTIONS = (ManualTranscriptionAction,)
ACTION_IDS_TO_CLASSES = {a.ID: a for a in ACTIONS}
