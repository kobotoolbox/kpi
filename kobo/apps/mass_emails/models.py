from collections.abc import Callable

from django.db import models

from kobo.apps.kobo_auth.shortcuts import User
from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel

USER_QUERIES: dict[str, Callable] = {}
USER_QUERY_CHOICES = {name: name.lower() for name in USER_QUERIES.keys()}


class EmailStatus(models.TextChoices):
    ENQUEUED = 'enqueued'
    FAILED = 'failed'
    SENT = 'sent'


class MassEmailConfig(AbstractTimeStampedModel):
    uid = KpiUidField(uid_prefix='mec')
    name = models.CharField()
    subject = models.CharField(null=True, blank=True, max_length=200)
    template = models.TextField(
        null=True,
        blank=True,
        help_text='Available placeholders:<br />'
        '##username##<br />'
        "##full_name## - user\'s full name<br />"
        "##plan_name## - user\'s current subscription plan",
    )
    query = models.CharField(
        null=True, blank=True, max_length=100, choices=USER_QUERY_CHOICES
    )

    def __str__(self):
        return self.name


class MassEmailJob(AbstractTimeStampedModel):
    email_config = models.ForeignKey(MassEmailConfig, on_delete=models.PROTECT)
    uid = KpiUidField(uid_prefix='mej')

    def __str__(self):
        return f'{self.email_config} started at {self.date_created.isoformat()}'


class MassEmailRecord(AbstractTimeStampedModel):
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    email_job = models.ForeignKey(MassEmailJob, on_delete=models.PROTECT)
    status = models.CharField(choices=EmailStatus.choices, null=True, blank=True)
    uid = KpiUidField(uid_prefix='mer')

    def __str__(self):
        return f'{self.email_job.email_config} send to {self.user.username}'
