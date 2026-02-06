from .base import ActionClassConfig, BaseManualNLPAction, ReviewType
from .mixins import TranscriptionActionMixin


class ManualTranscriptionAction(TranscriptionActionMixin, BaseManualNLPAction):

    ID = 'manual_transcription'
    action_class_config = ActionClassConfig(
        allow_multiple=False, automatic=False, review_type=ReviewType.ACCEPTANCE
    )
