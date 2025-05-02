from rest_framework import serializers


# An external class that defines the type of field we want (mostly JSONFields)
# that will be called by the kpi utils (at kpi.utils.docs.schema.py) and be told
# what it should return and generate in the schema.
class AccessLogMetadataField(serializers.JSONField):
    pass
