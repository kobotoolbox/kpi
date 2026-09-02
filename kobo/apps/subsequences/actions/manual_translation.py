from ..constants import TRANSLATABLE_SOURCE_TYPES
from .base import ActionClassConfig, BaseManualNLPAction, ReviewType
from .mixins import TranslationActionMixin


class ManualTranslationAction(TranslationActionMixin, BaseManualNLPAction):

    ID = 'manual_translation'
    allowed_source_types = TRANSLATABLE_SOURCE_TYPES
    action_class_config = ActionClassConfig(
        allow_multiple=True,
        automatic=False,
        action_data_key='language',
        review_type=ReviewType.ACCEPTANCE,
    )
