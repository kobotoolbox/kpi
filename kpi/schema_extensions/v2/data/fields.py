from rest_framework import serializers


class DataValidationStatusesPayloadField(serializers.ListField):
    pass

class DataBulkUpdateField(serializers.ListField):
    pass

class DataBulkDeleteField(serializers.JSONField):
    pass

class DataBulkUpdateResultField(serializers.ListField):
    pass
