from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.utils.translation import gettext as t
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


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

    class Meta:
        model = SocialAccount
        fields = (
            'provider',
            'uid',
            'last_login',
            'date_joined',
            'email',
            'username',
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
