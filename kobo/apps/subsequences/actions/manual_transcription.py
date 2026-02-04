
from .base import ActionClassConfig, BaseManualNLPAction
from .mixins import TranscriptionActionMixin


class ManualTranscriptionAction(TranscriptionActionMixin, BaseManualNLPAction):

    ID = 'manual_transcription'
    action_class_config = ActionClassConfig(
        allow_multiple=False, automatic=False, requires_acceptance=True
    )
