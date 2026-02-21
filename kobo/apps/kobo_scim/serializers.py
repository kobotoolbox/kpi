from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from kobo.apps.kobo_auth.shortcuts import User


class ScimUserSerializer(serializers.ModelSerializer):
    """
    Serializes a Django User to match the SCIM 2.0 User schema.
    """

    schemas = serializers.SerializerMethodField()
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
