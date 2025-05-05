from rest_framework import serializers


# This external class defines the type of field we want to document — mostly JSONFields.
# It is used by drf-spectacular to generate the correct OpenAPI schema representation
# when paired with a corresponding OpenApiSerializerFieldExtension.
class AccessLogMetadataField(serializers.JSONField):
    pass
