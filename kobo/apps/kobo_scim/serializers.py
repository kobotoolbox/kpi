from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.models import ScimGroup


class ScimUserSerializer(serializers.ModelSerializer):
    """
    Serializes a Django User to match the SCIM 2.0 User schema.
    """

    schemas = serializers.SerializerMethodField()
    id = serializers.IntegerField(read_only=True)
    userName = serializers.CharField(source='username')
    name = serializers.SerializerMethodField()
    emails = serializers.SerializerMethodField()
    active = serializers.BooleanField(source='is_active')

    class Meta:
        model = User
        fields = ['schemas', 'id', 'userName', 'name', 'emails', 'active']

    @extend_schema_field(OpenApiTypes.ANY)
    def get_schemas(self, obj):
        return ['urn:ietf:params:scim:schemas:core:2.0:User']

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_name(self, obj):
        return {
            'formatted': obj.get_full_name() or obj.username,
            'familyName': obj.last_name,
            'givenName': obj.first_name,
        }

    @extend_schema_field(OpenApiTypes.ANY)
    def get_emails(self, obj):
        if obj.email:
            return [{'value': obj.email, 'type': 'work', 'primary': True}]
        return []


class ScimGroupSerializer(serializers.ModelSerializer):
    """
    Serializes a Django ScimGroup to match the SCIM 2.0 Group schema.
    """

    schemas = serializers.SerializerMethodField()
    id = serializers.CharField(read_only=True)
    displayName = serializers.CharField(source='name')
    externalId = serializers.CharField(
        source='scim_external_id', required=False, allow_blank=True
    )
    members = serializers.SerializerMethodField()

    class Meta:
        model = ScimGroup
        fields = ['schemas', 'id', 'displayName', 'externalId', 'members']

    @extend_schema_field(OpenApiTypes.ANY)
    def get_schemas(self, obj):
        return ['urn:ietf:params:scim:schemas:core:2.0:Group']

    @extend_schema_field(OpenApiTypes.ANY)
    def get_members(self, obj):
        # Only return basic identifying info for group members
        return [
            {
                'value': user.id,
                'display': user.username,
            }
            for user in obj.members.all()
        ]
