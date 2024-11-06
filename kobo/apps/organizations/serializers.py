from constance import config
from django.contrib.auth import get_user_model
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.reverse import reverse

from kobo.apps.organizations.models import (
    create_organization,
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kpi.utils.object_permission import get_database_user
from .constants import EXTERNAL_ORG_ROLE


class OrganizationUserSerializer(serializers.ModelSerializer):
    user = serializers.HyperlinkedRelatedField(
        queryset=get_user_model().objects.all(),
        lookup_field='username',
        view_name='user-kpi-detail',
    )
    role = serializers.CharField()
    has_mfa_enabled = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(
        source='user.date_joined', format='%Y-%m-%dT%H:%M:%SZ'
    )
    user__username = serializers.ReadOnlyField(source='user.username')
    user__name = serializers.ReadOnlyField(source='user.get_full_name')
    user__email = serializers.ReadOnlyField(source='user.email')
    is_active = serializers.ReadOnlyField(source='user.is_active')

    class Meta:
        model = OrganizationUser
        fields = [
            'url',
            'user',
            'user__username',
            'user__email',
            'user__name',
            'role',
            'has_mfa_enabled',
            'date_joined',
            'is_active'
        ]

    def get_has_mfa_enabled(self, obj):
        return config.MFA_ENABLED

    def get_url(self, obj):
        request = self.context.get('request')
        return reverse(
            'organization-members-detail',
            kwargs={
                'organization_id': obj.organization.id,
                'user__username': obj.user.username
            },
            request=request
        )

    def validate_role(self, role):
        if role not in ['admin', 'member']:
            raise serializers.ValidationError(
                {'role': t("Invalid role. Only 'admin' or 'member' are allowed")}
            )
        return role


class OrganizationOwnerSerializer(serializers.ModelSerializer):
    organization_user = OrganizationUserSerializer()

    class Meta:
        model = OrganizationOwner
        fields = ['organization_user']


class OrganizationSerializer(serializers.ModelSerializer):

    is_mmo = serializers.BooleanField(read_only=True)
    is_owner = serializers.SerializerMethodField()
    request_user_role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id',
            'name',
            'is_active',
            'created',
            'modified',
            'slug',
            'is_owner',
            'is_mmo',
            'request_user_role',
        ]
        read_only_fields = ['id', 'slug']

    def create(self, validated_data):
        user = self.context['request'].user
        return create_organization(user, validated_data['name'])

    def get_is_owner(self, organization):

        # This method is deprecated.
        # Use `get_request_user_role` to retrieve the value instead.
        if request := self.context.get('request'):
            user = get_database_user(request.user)
            return organization.is_owner(user)

        return False

    def get_request_user_role(self, organization):

        if request := self.context.get('request'):
            user = get_database_user(request.user)
            return organization.get_user_role(user)

        return EXTERNAL_ORG_ROLE
