from django.db import models


class UserReportMaterialized(models.Model):
    """
    Django model representing the user_report_mv materialized view.
    """
    user_id = models.BigIntegerField(primary_key=True)

    # Basic user fields
    username = models.CharField(max_length=255)
    first_name = models.CharField(max_length=255, null=True, blank=True)
    last_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    is_superuser = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(null=True)
    last_login = models.DateTimeField(null=True)

    # Extra details
    extra_details_uid = models.CharField(max_length=255, null=True, blank=True)
    metadata = models.JSONField(null=True, default=dict)

    # Boolean flags
    accepted_tos = models.BooleanField(null=True, default=False)
    validated_email = models.BooleanField(null=True, default=False)
    validated_password = models.BooleanField(null=True, default=False)
    sso_is_active = models.BooleanField(null=True, default=False)
    mfa_is_active = models.BooleanField(null=True, default=False)

    # Social accounts as JSON array
    social_accounts = models.JSONField(null=True, default=list)

    # Asset counts
    asset_count = models.IntegerField(default=0)
    deployed_asset_count = models.IntegerField(default=0)

    total_storage_bytes = models.BigIntegerField(default=0)

    submission_counts_all_time = models.BigIntegerField(default=0)
    nlp_usage_asr_seconds_all_time = models.BigIntegerField(default=0)
    nlp_usage_mt_characters_all_time = models.BigIntegerField(default=0)

    # Organization data
    organization_id = models.IntegerField(null=True, blank=True)
    organization_name = models.CharField(max_length=255, null=True, blank=True)
    organization_uid = models.CharField(max_length=255, null=True, blank=True)
    is_org_admin = models.BooleanField(default=False)
    metadata_organization_type = models.CharField(max_length=255, null=True, blank=True)

    subscriptions = models.JSONField(null=True, default=list)

    last_refresh = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'user_report_mv'

    def __str__(self):
        return f'UserReportMaterialized({self.username})'
