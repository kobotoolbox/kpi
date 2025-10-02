import uuid

from django.db import models
from django.utils import timezone


class BillingAndUsageSnapshotStatus(models.TextChoices):
    RUNNING = 'running'
    COMPLETED = 'completed'
    ABORTED = 'aborted'


class BillingAndUsageSnapshot(models.Model):
    """
    A snapshot table for storing precomputed organization billing and usage data.

    Why this table exists:
    1. Maintaining billing period calculations directly inside the materialized view
       would make it too complex and hard to manage.
    2. Usage data such as total submissions, current period submissions, and storage
       resides in the `kobocat` db, while the materialized view lives in the `kpi`
       db. Joining across databases for 1.7M+ users would be inefficient.
    3. A periodic Celery task precomputes these values and writes them here.
       The materialized view then joins against this table efficiently.
    """

    organization_id = models.CharField(max_length=64, unique=True)
    effective_user_id = models.IntegerField(null=True, blank=True, db_index=True)
    storage_bytes_total = models.BigIntegerField(default=0)
    submission_counts_all_time = models.BigIntegerField(default=0)
    current_period_submissions = models.BigIntegerField(default=0)
    billing_period_start = models.DateTimeField(null=True, blank=True)
    billing_period_end = models.DateTimeField(null=True, blank=True)
    snapshot_created_at = models.DateTimeField(default=timezone.now)
    last_snapshot_run_id = models.UUIDField(null=True, blank=True, db_index=True)

    class Meta:
        managed = False
        db_table = 'billing_and_usage_snapshot'
        indexes = [
            models.Index(fields=['effective_user_id']),
            models.Index(fields=['snapshot_created_at']),
            models.Index(fields=['last_snapshot_run_id']),
        ]

    def __str__(self):
        return f'BillingAndUsageSnapshot(org={self.organization_id})'


class BillingAndUsageSnapshotRun(models.Model):
    """
    Tracks the status and progress of billing and usage snapshot runs
    """
    id = models.BigAutoField(primary_key=True)
    run_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(
        max_length=32,
        choices=BillingAndUsageSnapshotStatus.choices,
        default=BillingAndUsageSnapshotStatus.RUNNING
    )
    started_at = models.DateTimeField(default=timezone.now)
    last_heartbeat_at = models.DateTimeField(default=timezone.now)
    last_processed_org_id = models.CharField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    details = models.JSONField(null=True, blank=True)

    class Meta:
        db_table = 'billing_and_usage_snapshot_run'
        managed = False
        ordering = ['-started_at']


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

    storage_bytes_total = models.BigIntegerField(default=0)
    submission_counts_all_time = models.BigIntegerField(default=0)
    nlp_usage_asr_seconds_total = models.BigIntegerField(default=0)
    nlp_usage_mt_characters_total = models.BigIntegerField(default=0)
    asset_count = models.IntegerField(default=0)
    deployed_asset_count = models.IntegerField(default=0)

    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    current_period_submissions = models.BigIntegerField(default=0)
    current_period_asr = models.BigIntegerField(default=0)
    current_period_mt = models.BigIntegerField(default=0)
    organization_id = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'user_reports_mv'
