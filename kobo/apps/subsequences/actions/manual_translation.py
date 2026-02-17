from .base import ActionClassConfig, BaseManualNLPAction, ReviewType
from .mixins import TranslationActionMixin


class ManualTranslationAction(TranslationActionMixin, BaseManualNLPAction):

    ID = 'manual_translation'
    action_class_config = ActionClassConfig(
        allow_multiple=True,
        automatic=False,
        action_data_key='language',
        review_type=ReviewType.ACCEPTANCE,
    )
