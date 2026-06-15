from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class AssetUrlField(serializers.URLField):
    pass


class ContentURlField(serializers.URLField):
    pass


class FileUrlField(serializers.URLField):
    pass


class MetadataField(serializers.JSONField):
    pass


class MetadataCreateField(serializers.JSONField):
    pass


@extend_schema_field(
    {
        'type': 'object',
        'required': ['filename'],
        'properties': {
            'filename': {'type': 'string'},
        },
    }
)
class MetadataBase64Field(serializers.JSONField):
    """Typed metadata for base64-encoded file uploads: requires ``filename``."""

    pass


@extend_schema_field(
    {
        'type': 'object',
        'required': ['redirect_url'],
        'properties': {
            'redirect_url': {'type': 'string', 'format': 'uri'},
        },
    }
)
class MetadataURLField(serializers.JSONField):
    """Typed metadata for URL-based file uploads: requires ``redirect_url``."""

    pass


class UserUrlField(serializers.URLField):
    pass
