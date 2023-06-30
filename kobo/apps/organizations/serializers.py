from rest_framework import serializers

from .models import Organization, OrganizationUser, create_organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'is_active', 'created', 'modified', 'slug']
        read_only_fields = ["id", "slug"]

    def create(self, validated_data):
        user = self.context['request'].user
        return create_organization(user, validated_data['name'])


class OrganizationUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationUser
        fields = ("user", "is_admin", "email")
        read_only_fields = ("user",)
