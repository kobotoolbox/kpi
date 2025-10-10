from django.db import models
from django.db.models import Q

from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel


class BillingAndUsageSnapshotStatus(models.TextChoices):
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    ABORTED = 'aborted'


class BillingAndUsageSnapshot(AbstractTimeStampedModel):
    """
    A snapshot table for storing precomputed organization billing dates,
    submission counts, and storage usage data.

    Why this table exists:
    1. Maintaining billing period calculations directly inside the materialized view
       would make it too complex and hard to manage.
    2. Usage data such as total submissions, current period submissions, and storage
       resides in the `kobocat` db, while the materialized view lives in the `kpi`
       db. Joining across databases for 1.7M+ users would be inefficient.
    3. A periodic Celery task (`refresh_user_report_snapshots`) precomputes these
       values and writes them here. The materialized view then joins against this
       table efficiently.
    """

    organization = models.OneToOneField(
        'organizations.Organization', on_delete=models.CASCADE
    )
    effective_user_id = models.IntegerField(null=True, blank=True, db_index=True)
    total_storage_bytes = models.BigIntegerField(default=0)
    total_submission_count_all_time = models.BigIntegerField(default=0)
    total_submission_count_current_period = models.BigIntegerField(default=0)
    billing_period_start = models.DateTimeField(null=True, blank=True)
    billing_period_end = models.DateTimeField(null=True, blank=True)
    last_snapshot_run = models.ForeignKey(
        'user_reports.BillingAndUsageSnapshotRun',
        related_name='snapshots',
        on_delete=models.CASCADE,
    )

    class Meta:
        indexes = [
            models.Index(fields=['effective_user_id'], name='idx_bau_user'),
            models.Index(fields=['date_created'], name='idx_bau_created'),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=['organization'], name='uniq_snapshot_per_org'
            ),
        ]

    def __str__(self):
        return f'BillingAndUsageSnapshot(org={self.organization_id})'


class BillingAndUsageSnapshotRun(AbstractTimeStampedModel):
    """
    A snapshot run table to track the progress and status of the
    `refresh_user_report_snapshots` Celery task.
    """

    uid = KpiUidField('busr')
    status = models.CharField(
        max_length=32,
        choices=BillingAndUsageSnapshotStatus.choices,
        default=BillingAndUsageSnapshotStatus.IN_PROGRESS,
    )
    last_processed_org_id = models.CharField(null=True, blank=True)
    details = models.JSONField(null=True, blank=True)
    singleton = models.BooleanField(default=True, editable=False)

    class Meta:
        ordering = ['-date_created']
        indexes = [
            models.Index(
                fields=['status', 'date_modified'], name='idx_bau_run_status_expires'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=('singleton',),
                condition=Q(status=BillingAndUsageSnapshotStatus.IN_PROGRESS),
                name='uniq_run_in_progress',
            ),
        ]


class UserReports(models.Model):
    extra_details_uid = models.CharField(null=True, blank=True)
    username = models.CharField()
    first_name = models.CharField()
    last_name = models.CharField()
    email = models.EmailField()
    is_superuser = models.BooleanField()
    is_staff = models.BooleanField()
    is_active = models.BooleanField()
    date_joined = models.CharField()
    last_login = models.CharField(null=True, blank=True)
    validated_email = models.BooleanField()
    validated_password = models.BooleanField()
    mfa_is_active = models.BooleanField()
    sso_is_active = models.BooleanField()
    accepted_tos = models.BooleanField()
    social_accounts = models.JSONField(default=list)
    organizations = models.JSONField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    subscriptions = models.JSONField(default=list)

    total_storage_bytes = models.BigIntegerField(default=0)
    total_submission_count_all_time = models.BigIntegerField(default=0)
    total_submission_count_current_period = models.BigIntegerField(default=0)

    total_nlp_usage_asr_seconds_all_time = models.BigIntegerField(default=0)
    total_nlp_usage_mt_characters_all_time = models.BigIntegerField(default=0)
    total_nlp_usage_asr_seconds_current_period = models.BigIntegerField(default=0)
    total_nlp_usage_mt_characters_current_period = models.BigIntegerField(default=0)

    asset_count = models.IntegerField(default=0)
    deployed_asset_count = models.IntegerField(default=0)

    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    service_usage = models.JSONField(null=True, blank=True)
    organization_id = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'user_reports_userreportsmv'
