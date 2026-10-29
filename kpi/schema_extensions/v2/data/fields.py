from rest_framework import serializers


class DataAttachmentsField(serializers.ListField):
    pass


class DataBulkDeleteField(serializers.JSONField):
    pass


class DataBulkUpdatePayloadField(serializers.ListField):
    pass


class DataBulkUpdateResultField(serializers.ListField):
    pass


class DataSupplementalDetailsField(serializers.JSONField):
    pass


class DataValidationPayloadField(serializers.JSONField):
    pass


class DataValidationStatusField(serializers.JSONField):
    pass


class EnketoEditUrlField(serializers.URLField):
    pass


class EnketoViewUrlField(serializers.URLField):
    pass


class GeoLocationField(serializers.ListField):
    pass
