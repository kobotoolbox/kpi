from rest_framework import serializers

from kobo.apps.kobo_scim.constants import SCIM_SCHEMA_ERROR


class ScimErrorSerializer(serializers.Serializer):
    """
    Serializes SCIM 2.0 Error responses matching RFC7644
    """

    schemas = serializers.ListField(
        child=serializers.CharField(),
        default=[SCIM_SCHEMA_ERROR],
    )
    detail = serializers.CharField(
        help_text='A detailed, human-readable message.'
    )
    status = serializers.CharField(
        help_text='The HTTP status code.'
    )
