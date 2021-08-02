# coding: utf-8
from django.db import models
from shortuuid import ShortUUID


# should be 22 per shortuuid documentation, but keeping at 21 to avoid having
# to migrate dkobo (see SurveyDraft.kpi_asset_uid)
UUID_LENGTH = 21


class KpiUidField(models.CharField):
    """
    If empty, automatically populates itself with a UID before saving
    """
    def __init__(self, uid_prefix):
        self.uid_prefix = uid_prefix
        total_length = len(uid_prefix) + UUID_LENGTH
        super().__init__(max_length=total_length, unique=True)

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        kwargs['uid_prefix'] = self.uid_prefix
        del kwargs['max_length']
        del kwargs['unique']
        return name, path, args, kwargs

    def generate_uid(self) -> str:
        return KpiUidField.generate_unique_id(self.uid_prefix)

    @staticmethod
    def generate_unique_id(prefix: str = None) -> str:
        # When UID_LENGTH is 22, that should be changed to:
        # return self.uid_prefix + shortuuid.uuid()
        if not prefix:
            prefix = ''
        return f'{prefix}{ShortUUID().random(UUID_LENGTH)}'

    def pre_save(self, model_instance, add):
        value = getattr(model_instance, self.attname)
        if value == '' or value is None:
            value = self.generate_uid()
            setattr(model_instance, self.attname, value)
        return value
