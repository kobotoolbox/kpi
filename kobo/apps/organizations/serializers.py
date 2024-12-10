from django.contrib.auth import get_user_model
from django.utils.translation import gettext as t
from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField
from rest_framework.reverse import reverse

from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
    create_organization,
)
from kpi.utils.object_permission import get_database_user

from .constants import ORG_EXTERNAL_ROLE


class OrganizationUserSerializer(serializers.ModelSerializer):
    user = serializers.HyperlinkedRelatedField(
        queryset=get_user_model().objects.all(),
        lookup_field='username',
        view_name='user-kpi-detail',
    )
    role = serializers.CharField()
    user__has_mfa_enabled = serializers.BooleanField(
        source='has_mfa_enabled', read_only=True
    )
    url = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(
        source='user.date_joined', format='%Y-%m-%dT%H:%M:%SZ'
    )
    user__username = serializers.ReadOnlyField(source='user.username')
    user__extra_details__name = serializers.ReadOnlyField(
        source='user.extra_details.data.name'
    )
    user__email = serializers.ReadOnlyField(source='user.email')
    user__is_active = serializers.ReadOnlyField(source='user.is_active')

    class Meta:
        model = OrganizationUser
        fields = [
            'url',
            'user',
            'user__username',
            'user__email',
            'user__extra_details__name',
            'role',
            'user__has_mfa_enabled',
            'date_joined',
            'user__is_active'
        ]

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

    def update(self, instance, validated_data):
        if role := validated_data.get('role', None):
            validated_data['is_admin'] = role == 'admin'
        return super().update(instance, validated_data)

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

    assets = serializers.SerializerMethodField()
    asset_usage = serializers.SerializerMethodField()
    is_mmo = serializers.BooleanField(read_only=True)
    is_owner = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    request_user_role = serializers.SerializerMethodField()
    service_usage = serializers.SerializerMethodField()
    url = HyperlinkedIdentityField(lookup_field='id', view_name='organizations-detail')
    website = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Organization
        fields = [
            'id',
            'url',
            'name',
            'website',
            'organization_type',
            'created',
            'modified',
            'is_owner',
            'is_mmo',
            'request_user_role',
            'members',
            'assets',
            'service_usage',
            'asset_usage',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        user = self.context['request'].user
        return create_organization(user, validated_data['name'])

    def get_assets(self, organization: Organization) -> str:
        return reverse(
            'organizations-assets',
            kwargs={'id': organization.id},
            request=self.context['request'],
        )

    def get_asset_usage(self, organization: Organization) -> str:
        return reverse(
            'organizations-asset-usage',
            kwargs={'id': organization.id},
            request=self.context['request'],
        )

    def get_members(self, organization: Organization) -> str:
        return reverse(
            'organization-members-list',
            kwargs={'organization_id': organization.id},
            request=self.context['request'],
        )

    def get_service_usage(self, organization: Organization) -> str:
        return reverse(
            'organizations-service-usage',
            kwargs={'id': organization.id},
            request=self.context['request'],
        )

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

        return ORG_EXTERNAL_ROLE
