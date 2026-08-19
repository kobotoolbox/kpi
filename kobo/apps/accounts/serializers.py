from allauth.account.models import EmailAddress
from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.models import SocialAccount
from django.utils.translation import gettext as t
from django_request_cache import cache_for_request
from drf_spectacular.plumbing import build_array_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kpi.schema_extensions.v2.generic.schema import GENERIC_STRING_SCHEMA
from kpi.utils.log import logging


class EmailAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAddress
        fields = ('primary', 'email', 'verified')
        read_only_fields = ('verified', 'primary')

    def create(self, validated_data):
        # First delete any non-primary, unconfirmed emails
        request = self.context['request']
        request.user.emailaddress_set.exclude(
            email=validated_data['email']
        ).filter(primary=False, verified=False).delete()
        return EmailAddress.objects.add_email(
            request,
            request.user,
            validated_data['email'],
            confirm=True,
        )

    def validate(self, attrs):
        """
        Validates that only owners or admins of the organization can update
        their email and only if they don't have an SSO-provided email
        """
        request = self.context['request']
        user = request.user
        organization = user.organization
        # check if we have an SSO-provided email
        # assume if we have an email address and an SSO account then the email comes
        # from the SSO
        if user.socialaccount_set.exists() and user.emailaddress_set.exists():
            raise serializers.ValidationError(
                {'email': t('This action is not allowed.')}
            )
        if organization.is_owner(user) or organization.is_admin(user):
            return attrs
        raise serializers.ValidationError(
            {'email': t('This action is not allowed.')}
        )


# https://github.com/iMerica/dj-rest-auth/blob/6b394d9d6bb1f2979ea2d31e5a1199368d5616c1/dj_rest_auth/registration/serializers.py#L22
# https://gitlab.com/glitchtip/glitchtip-backend/-/blob/master/users/serializers.py#L40
class SocialAccountSerializer(serializers.ModelSerializer):
    """
    serialize allauth SocialAccounts for use with a REST API
    """

    email = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    managed = serializers.SerializerMethodField()
    managed_domains = serializers.SerializerMethodField()

    class Meta:
        model = SocialAccount
        fields = (
            'provider',
            'uid',
            'last_login',
            'date_joined',
            'email',
            'username',
            'managed',
            'managed_domains',
        )

    @extend_schema_field(OpenApiTypes.EMAIL)
    def get_email(self, obj):
        if obj.extra_data:
            if 'email' in obj.extra_data:
                return obj.extra_data.get('email')
            return obj.extra_data.get('userPrincipalName')  # MS oauth uses this

    @extend_schema_field(OpenApiTypes.STR)
    def get_username(self, obj):
        if obj.extra_data:
            return obj.extra_data.get('username')

    @cache_for_request
    def get_social_app_custom_data(self, obj):
        provider = obj.provider
        candidate_apps = get_adapter().list_apps(
            self.context.get('request'), provider=provider
        )
        if len(candidate_apps) > 1:
            # mirror logic in allauth get_app(), but warn instead of raising an error
            visible_apps = [
                app for app in candidate_apps if not app.settings.get('hidden')
            ]
            if len(visible_apps) > 1:
                logging.warn(
                    f'Multiple social apps returned for provider {provider},'
                    f' returning first visible candidate'
                )
                app = visible_apps[0]
        elif len(candidate_apps) == 0:
            logging.warn(f'No social app found for provider {provider}')
            return None
        else:
            app = candidate_apps[0]
        try:
            return SocialAppCustomData.objects.get(social_app=app)
        except SocialAppCustomData.DoesNotExist:
            return None

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_managed(self, obj):
        social_app_custom_data = self.get_social_app_custom_data(obj)
        return bool(social_app_custom_data) and social_app_custom_data.managed

    @extend_schema_field(build_array_type(schema=GENERIC_STRING_SCHEMA))
    def get_managed_domains(self, obj):
        social_app_custom_data = self.get_social_app_custom_data(obj)
        if not social_app_custom_data:
            return []
        return list(
            SocialAppManagedDomain.objects.filter(
                social_app=social_app_custom_data
            ).values_list('domain', flat=True)
        )
