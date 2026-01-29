from .base import ActionClassConfig, BaseManualNLPAction
from .mixins import TranslationActionMixin


class ManualTranslationAction(TranslationActionMixin, BaseManualNLPAction):

    ID = 'manual_translation'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=False, action_data_key='language'
    )
