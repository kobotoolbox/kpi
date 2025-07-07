from drf_spectacular.plumbing import build_array_type, build_object_type, build_basic_type
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers


class DataAttachmentField(serializers.JSONField):
    pass


class DataBulkDeleteField(serializers.JSONField):
    pass


class DataBulkUpdateField(serializers.ListField):
    pass


class DataBulkUpdateResultField(serializers.ListField):
    pass


class DataValidationPayloadField(serializers.JSONField):
    pass


class EmptyListField(serializers.ListField):
    build_array_type(schema=build_basic_type(OpenApiTypes.STR))


class EmptyObjectField(serializers.JSONField):
    build_object_type(properties={})
