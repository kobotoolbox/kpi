from rest_framework import serializers


class ScimErrorSerializer(serializers.Serializer):
    """
    Serializes SCIM 2.0 Error responses matching RFC7644
    """

    schemas = serializers.ListField(
        child=serializers.CharField(),
        default=['urn:ietf:params:scim:api:messages:2.0:Error'],
    )
    detail = serializers.CharField(
        help_text='A detailed, human-readable message.'
    )
    status = serializers.CharField(
        help_text='The HTTP status code.'
    )
