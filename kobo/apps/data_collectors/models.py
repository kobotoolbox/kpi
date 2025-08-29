import secrets

from django.conf import settings
from django.db import models
from django.db.models import fields
from django_redis import get_redis_connection

from kobo.apps.data_collectors.constants import DC_ENKETO_URL_TEMPLATE
from kobo.apps.data_collectors.utils import remove_data_collector_enketo_links
from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel


class DataCollectorGroup(AbstractTimeStampedModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    uid = KpiUidField(uid_prefix='dcg', primary_key=True)
    name = fields.CharField(max_length=200)

    def __str__(self):
        return '{} ({})'.format(self.name, self.uid)


class DataCollector(AbstractTimeStampedModel):
    uid = KpiUidField(uid_prefix='dc', primary_key=True)
    name = fields.CharField(null=True, blank=True, max_length=200)
    token = fields.CharField(max_length=40)
    group = models.ForeignKey(
        DataCollectorGroup,
        on_delete=models.SET_NULL,
        related_name='data_collectors',
        null=True,
        blank=True,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._initial_token = self.token
        self._initial_group_id = self.group_id

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = self.generate_key()
        super().save()

    def rotate_token(self):
        self.token = None
        self.save()

    @classmethod
    def generate_key(cls):
        return secrets.token_hex(20)
