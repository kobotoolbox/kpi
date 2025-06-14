from collections.abc import Callable
from enum import Enum

from django.db import models
from import_export import fields, resources

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import (
    get_all_test_users,
    get_inactive_users,
    get_users_over_80_percent_of_nlp_limits,
    get_users_over_80_percent_of_storage_limit,
    get_users_over_80_percent_of_submission_limit,
    get_users_over_90_percent_of_nlp_limits,
    get_users_over_90_percent_of_storage_limit,
    get_users_over_90_percent_of_submission_limit,
    get_users_over_100_percent_of_nlp_limits,
    get_users_over_100_percent_of_storage_limit,
    get_users_over_100_percent_of_submission_limit,
)
from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel

USER_QUERIES: dict[str, Callable] = {
    'users_above_80_percent_storage': get_users_over_80_percent_of_storage_limit,
    'users_above_90_percent_storage': get_users_over_90_percent_of_storage_limit,
    'users_above_100_percent_storage': get_users_over_100_percent_of_storage_limit,
    'users_inactive_for_365_days': get_inactive_users,
    'users_above_80_percent_submissions': get_users_over_80_percent_of_submission_limit,
    'users_above_90_percent_submissions': get_users_over_90_percent_of_submission_limit,
    'users_above_100_percent_submissions': get_users_over_100_percent_of_submission_limit,  # noqa
    'users_above_80_percent_nlp_usage': get_users_over_80_percent_of_nlp_limits,
    'users_above_90_percent_nlp_usage': get_users_over_90_percent_of_nlp_limits,
    'users_above_100_percent_nlp_usage': get_users_over_100_percent_of_nlp_limits,
    'test_users': get_all_test_users,
}
USER_QUERY_CHOICES = [(name, name.lower()) for name in USER_QUERIES.keys()]
EmailType = Enum('EmailType', ['RECURRING', 'ONE_TIME'])


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
        "##full_name## - user's full name<br />"
        "##plan_name## - user's current subscription plan",
    )
    query = models.CharField(
        null=True, blank=True, max_length=100, choices=USER_QUERY_CHOICES
    )
    frequency = models.IntegerField(default=-1)
    live = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    @property
    def type(self):
        if self.frequency == -1:
            return EmailType.ONE_TIME
        return EmailType.RECURRING

    @classmethod
    def export_resource_classes(cls):
        return {
            'mass_email_config_recipients': (
                'Expected recipients resource',
                MassEmailConfigExpectedRecipientsResource,
            ),
        }


class MassEmailConfigExpectedRecipientsResource(resources.ModelResource):
    recipients = fields.Field(dehydrate_method='get_recipients')

    class Meta:
        model = MassEmailConfig
        fields = (
            'name',
            'recipients',
        )

    def get_recipients(self, email_config):
        user_queryset = USER_QUERIES.get(email_config.query, lambda: [])()
        return [
            user
            for user in user_queryset.values('username', 'email', 'extra_details__uid')
        ]

    def after_export(self, queryset, dataset, **kwargs):
        # change from 1 row per config to 1 row per user
        super().after_export(queryset, dataset, **kwargs)
        preformatted = dataset._data
        reformatted = []
        for [config_name, users] in preformatted:
            for user in users:
                reformatted.append(
                    [
                        config_name,
                        user['username'],
                        user['email'],
                        user['extra_details__uid'],
                    ]
                )
        # empty the old dataset so we can set the new headers without an
        # "InvalidDimensions" error
        dataset.wipe()
        dataset.headers = ['MassEmailConfig name', 'username', 'email', 'uid']
        dataset._data = reformatted


class MassEmailJob(AbstractTimeStampedModel):
    email_config = models.ForeignKey(
        MassEmailConfig, on_delete=models.PROTECT, related_name='jobs'
    )
    uid = KpiUidField(uid_prefix='mej')

    def __str__(self):
        return f'{self.email_config} started at {self.date_created.isoformat()}'


class MassEmailRecord(AbstractTimeStampedModel):
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    email_job = models.ForeignKey(
        MassEmailJob, on_delete=models.PROTECT, related_name='records'
    )
    status = models.CharField(choices=EmailStatus.choices, null=True, blank=True)
    uid = KpiUidField(uid_prefix='mer')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['email_job', 'user'], name='unique_user_per_email_job'
            )
        ]

    def __str__(self):
        return f'{self.email_job.email_config} send to {self.user.username}'
