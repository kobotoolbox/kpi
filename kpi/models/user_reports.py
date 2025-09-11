from django.db import models
from django.utils import timezone

from kobo.apps.organizations.models import Organization


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


class BillingAndUsageSnapshot(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='billing_and_usage_snapshots'
    )
    effective_user_id = models.IntegerField()
    storage_bytes_total = models.BigIntegerField(default=0)
    submission_counts_all_time = models.BigIntegerField(default=0)
    current_period_submissions = models.BigIntegerField(default=0)
    billing_period_start = models.DateTimeField(null=True, blank=True)
    billing_period_end = models.DateTimeField(null=True, blank=True)
    snapshot_created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = 'billing_and_usage_snapshot'
        indexes = [
            models.Index(fields=['organization'], name='idx_bau_org'),
            models.Index(fields=['effective_user_id'], name='idx_bau_user'),
            models.Index(fields=['snapshot_created_at'], name='idx_bau_created'),
        ]

    def __str__(self):
        return f'Billing+Usage snapshot for {self.organization_id} (user={self.effective_user_id})'
