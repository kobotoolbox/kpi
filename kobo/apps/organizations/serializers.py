from rest_framework import serializers

from kobo.apps.organizations.models import (
    create_organization,
    Organization,
    OrganizationOwner,
    OrganizationUser,
)


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
    is_owner = serializers.SerializerMethodField('_is_owner')

    def _is_owner(self, instance):
        user = self.context['request'].user
        return instance.owner.organization_user.user.id == user.id

    class Meta:
        model = Organization
        fields = ['id', 'name', 'is_active', 'created', 'modified', 'slug', 'is_owner']
        read_only_fields = ['id', 'slug']

    def create(self, validated_data):
        user = self.context['request'].user
        return create_organization(user, validated_data['name'])
