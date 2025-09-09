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


class BillingPeriodsSnapshot(models.Model):
    """
    Snapshot table to store pre-computed billing periods for organizations.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='billing_snapshots'
    )
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    snapshot_created_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = 'billing_periods_snapshot'
        indexes = [
            models.Index(
                fields=['organization', 'is_active'],
                name='idx_billing_org_active',
                condition=models.Q(is_active=True)
            ),
            models.Index(
                fields=['snapshot_created_at'],
                name='idx_billing_created_at'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['organization'],
                condition=models.Q(is_active=True),
                name='unique_active_org_billing'
            )
        ]

    def __str__(self):
        return f'Billing snapshot for {self.organization.name} ({self.current_period_start} - {self.current_period_end})'

    @classmethod
    def get_active_snapshot(cls, organization_id):
        """
        Get the active billing snapshot for an organization
        """
        try:
            return cls.objects.get(organization_id=organization_id, is_active=True)
        except cls.DoesNotExist:
            return None

    @classmethod
    def cleanup_old_snapshots(cls, days_to_keep=7):
        """
        Remove old inactive snapshots to prevent table bloat
        """
        cutoff_date = timezone.now() - timezone.timedelta(days=days_to_keep)
        return cls.objects.filter(
            is_active=False,
            snapshot_created_at__lt=cutoff_date
        ).delete()


class OrganizationUsageSnapshot(models.Model):
    """
    Separate table to store cross-database usage data per organization
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='usage_snapshots'
    )
    # Effective user ID (organization owner for MMO, regular user for others)
    effective_user_id = models.IntegerField()
    storage_bytes_total = models.BigIntegerField(default=0)
    submission_counts_all_time = models.BigIntegerField(default=0)
    current_period_submissions = models.BigIntegerField(default=0)
    snapshot_created_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    # References to billing period for current period calculations
    billing_period_start = models.DateTimeField(null=True, blank=True)
    billing_period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'organization_usage_snapshot'
        indexes = [
            models.Index(
                fields=['organization', 'is_active'],
                name='idx_org_usage_org_active',
                condition=models.Q(is_active=True)
            ),
            models.Index(
                fields=['effective_user_id'],
                name='idx_org_usage_user'
            ),
            models.Index(
                fields=['snapshot_created_at'],
                name='idx_org_usage_created_at'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['organization'],
                condition=models.Q(is_active=True),
                name='unique_active_org_usage'
            )
        ]

    def __str__(self):
        return f'Usage snapshot for {self.organization.name} (User: {self.effective_user_id})'

    @classmethod
    def get_active_usage_snapshot(cls, organization_id):
        """
        Get the active usage snapshot for an organization
        """
        try:
            return cls.objects.get(organization_id=organization_id, is_active=True)
        except cls.DoesNotExist:
            return None
