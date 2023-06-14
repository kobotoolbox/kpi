from rest_framework import serializers

from kobo.apps.organizations.models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'is_active', 'created', 'modified', 'slug']
