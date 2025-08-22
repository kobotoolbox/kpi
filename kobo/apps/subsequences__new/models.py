# coding: utf-8

from django.db import models

from kpi.models import Asset
from kpi.models.abstract_models import AbstractTimeStampedModel


class SubmissionExtras(AbstractTimeStampedModel):

    submission_uuid = models.CharField(max_length=249)
    content = models.JSONField(default=dict)
    asset = models.ForeignKey(
        Asset,
        related_name='submission_extras',
        on_delete=models.CASCADE,
    )

    class Meta:
        # ideally `submission_uuid` is universally unique, but its uniqueness
        # per-asset is most important
        unique_together = (('asset', 'submission_uuid'),)
