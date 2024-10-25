from rest_framework import serializers

from kobo.apps.organizations.models import (
    create_organization,
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kpi.utils.object_permission import get_database_user
from .constants import EXTERNAL_ORG_ROLE


class OrganizationUserSerializer(serializers.ModelSerializer):

    class Meta:
        model = OrganizationUser
        fields = ['user', 'organization']


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
