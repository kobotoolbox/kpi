from .base import ActionClassConfig, ReviewType
from .qual import BaseQualAction


class ManualQualAction(BaseQualAction):

    ID = 'manual_qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True,
        automatic=False,
        action_data_key='uuid',
        review_type=ReviewType.VERIFICATION,
    )
