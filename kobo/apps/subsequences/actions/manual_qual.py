from .base import ActionClassConfig, ReviewType
from .qual import BaseQualAction
from ..constants import QUAL_SOURCE_TYPES, SOURCE_TYPE_MANUAL


class ManualQualAction(BaseQualAction):

    ID = 'manual_qual'
    allowed_source_types = QUAL_SOURCE_TYPES
    action_class_config = ActionClassConfig(
        allow_multiple=True,
        automatic=False,
        action_data_key='uuid',
        review_type=ReviewType.VERIFICATION,
    )

    @property
    def source(self):
        return SOURCE_TYPE_MANUAL
