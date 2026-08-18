from ..constants import TRANSCRIBABLE_SOURCE_TYPES
from .base import ActionClassConfig, BaseManualNLPAction, ReviewType
from .mixins import TranscriptionActionMixin


class ManualTranscriptionAction(TranscriptionActionMixin, BaseManualNLPAction):

    ID = 'manual_transcription'
    allowed_source_types = TRANSCRIBABLE_SOURCE_TYPES
    action_class_config = ActionClassConfig(
        allow_multiple=False, automatic=False, review_type=ReviewType.ACCEPTANCE
    )
