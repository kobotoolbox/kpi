from rest_framework import serializers


class SocialAppSerializer(serializers.Serializer):
    provider = serializers.CharField()
    name = serializers.CharField()
    client_id = serializers.CharField()
    provider_id = serializers.CharField(allow_blank=True, allow_null=True)


class MetadataFieldSerializer(serializers.Serializer):
    name = serializers.CharField()
    label = serializers.CharField()
    type = serializers.CharField(required=False, allow_blank=True)
    required = serializers.BooleanField(required=False)
    options = serializers.JSONField(required=False, allow_null=True)


class EnvironmentResponseSerializer(serializers.Serializer):
    terms_of_service_url = serializers.CharField(allow_blank=True, allow_null=True)
    privacy_policy_url = serializers.CharField(allow_blank=True, allow_null=True)
    source_code_url = serializers.CharField(allow_blank=True, allow_null=True)
    support_email = serializers.CharField(allow_blank=True, allow_null=True)
    support_url = serializers.CharField(allow_blank=True, allow_null=True)
    academy_url = serializers.CharField(allow_blank=True, allow_null=True)
    community_url = serializers.CharField(allow_blank=True, allow_null=True)
    frontend_min_retry_time = serializers.IntegerField()
    frontend_max_retry_time = serializers.IntegerField()
    use_team_label = serializers.BooleanField()
    usage_limit_enforcement = serializers.BooleanField()
    allow_self_account_deletion = serializers.BooleanField()
    project_history_log_lifespan = serializers.IntegerField()

    sector_choices = serializers.ListField(
        child=serializers.ListField(
            child=serializers.CharField(), min_length=2, max_length=2
        ),
        help_text='A list of (value, label) tuples for sectors',
    )
    operational_purpose_choices = serializers.ListField(
        child=serializers.ListField(
            child=serializers.CharField(), min_length=2, max_length=2
        ),
        help_text='A list of (value, label) tuples for operational purposes',
    )
    country_choices = serializers.ListField(
        child=serializers.ListField(
            child=serializers.CharField(), min_length=2, max_length=2
        ),
        help_text='A list of (country_code, country_name) tuples',
    )
    interface_languages = serializers.ListField(
        child=serializers.ListField(
            child=serializers.CharField(), min_length=2, max_length=2
        ),
        help_text='A list of (language_code, language_name) tuples',
    )

    # MFA
    mfa_localized_help_text = serializers.CharField(help_text='Markdown string for MFA help text')
    mfa_enabled = serializers.BooleanField()
    mfa_code_length = serializers.IntegerField()

    # Password
    enable_password_entropy_meter = serializers.BooleanField()
    enable_custom_password_guidance_text = serializers.BooleanField()
    custom_password_localized_help_text = serializers.CharField(
        help_text='Markdown string for custom password help text'
    )

    # Metadata Fields
    project_metadata_fields = MetadataFieldSerializer(many=True)
    extra_project_metadata_fields = MetadataFieldSerializer(many=True)
    user_metadata_fields = MetadataFieldSerializer(many=True)

    # Other configurations
    social_apps = SocialAppSerializer(many=True)
    asr_mt_features_enabled = serializers.BooleanField(
        help_text='Whether ASR and MT features are enabled for the current user'
    )
    submission_placeholder = serializers.CharField(
        help_text='Placeholder text for submissions'
    )
    stripe_public_key = serializers.CharField(allow_blank=True, allow_null=True)
    terms_of_service__sitewidemessage__exists = serializers.BooleanField(
        help_text='Indicates if a sitewide message for TOS exists'
    )

    # Static configurations
    open_rosa_server = serializers.URLField(help_text='The OpenRosa server URL (KC)')
