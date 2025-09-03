from django.db import models


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

    class Meta:
        managed = False
        db_table = 'user_reports_mv'
