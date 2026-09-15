from rest_framework import serializers

from kpi.constants import AUTH_THEME_CHOICES


class AuthConfigurationSerializer(serializers.Serializer):
    """
    Server branding and behaviour for the sign-in and account creation screens
    """

    theme = serializers.ChoiceField(
        choices=AUTH_THEME_CHOICES,
        help_text=(
            'Appearance of everything outside the sign-in container. '
            '`custom` whenever a login background image has been uploaded, '
            '`default` otherwise'
        ),
    )
    background_image_url = serializers.CharField(
        allow_null=True,
        help_text=(
            'Relative URL of the login background image, or `null` when none '
            'has been uploaded'
        ),
    )
    show_kobotoolbox_logo = serializers.BooleanField(
        help_text='Whether to display the KoboToolbox logo outside the container'
    )
    logo_url = serializers.CharField(
        allow_null=True,
        help_text=(
            'Relative URL of the logo shown inside the container, or `null` '
            'when none has been uploaded'
        ),
    )
    supporting_image_url = serializers.CharField(
        allow_null=True,
        help_text=(
            'Relative URL of the image displayed alongside the account '
            'creation form, or `null` when none has been uploaded'
        ),
    )
    supporting_text = serializers.CharField(
        allow_blank=True,
        help_text=(
            'Rendered HTML displayed alongside the account creation form, '
            'localized for the request language. Empty when unset'
        ),
    )
    allow_login_with_username = serializers.BooleanField(
        help_text=(
            'Whether this server accepts a username at sign-in. Reflects the '
            'login methods the server is configured with, so the sign-in form '
            'never offers a credential the server would reject'
        )
    )


class SocialAppSerializer(serializers.Serializer):
    provider = serializers.CharField()
    name = serializers.CharField()
    client_id = serializers.CharField()
    provider_id = serializers.CharField(allow_blank=True, allow_null=True)
    managed = serializers.BooleanField()
    domains = serializers.ListField(child=serializers.CharField())


class MetadataFieldOptionSerializer(serializers.Serializer):
    name = serializers.CharField()
    label = serializers.DictField(child=serializers.CharField())


class MetadataFieldSerializer(serializers.Serializer):
    name = serializers.CharField()
    label = serializers.CharField()
    type = serializers.CharField(required=False, allow_blank=True)
    required = serializers.BooleanField(required=False)
    options = MetadataFieldOptionSerializer(many=True, required=False, allow_null=True)


class EnvironmentResponseSerializer(serializers.Serializer):
    registration_open = serializers.BooleanField(
        help_text='Whether users may create their own accounts'
    )
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
    mfa_localized_help_text = serializers.CharField(
        help_text='Markdown string for MFA help text'
    )
    mfa_enabled = serializers.BooleanField()
    mfa_code_length = serializers.IntegerField()
    superuser_auth_enforcement = serializers.BooleanField()

    # Password
    enable_password_entropy_meter = serializers.BooleanField()
    enable_custom_password_guidance_text = serializers.BooleanField()
    custom_password_localized_help_text = serializers.CharField(
        help_text='Markdown string for custom password help text'
    )

    # Sign-in and account creation
    auth_configuration = AuthConfigurationSerializer()

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
