from drf_spectacular.plumbing import build_array_type, build_object_type
from rest_framework import serializers


class DataAttachmentField(serializers.JSONField):
    pass


class DataValidationStatusesPayloadField(serializers.ListField):
    pass


class DataBulkUpdateField(serializers.ListField):
    pass


class DataBulkDeleteField(serializers.JSONField):
    pass


class DataBulkUpdateResultField(serializers.ListField):
    pass


class EmptyListField(serializers.ListField):
    build_array_type(schema={})


class EmptyObjectField(serializers.JSONField):
    build_object_type(properties={})
