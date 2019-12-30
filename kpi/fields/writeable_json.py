# coding: utf-8
import json

from rest_framework import serializers


class WritableJSONField(serializers.Field):
    """
    Serializer for JSONField -- required to make field writable
    """

    def __init__(self, **kwargs):
        self.allow_blank = kwargs.pop('allow_blank', False)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        if (not data) and (not self.required):
            return None
        else:
            try:
                return json.loads(data)
            except Exception as e:
                raise serializers.ValidationError(
                    'Unable to parse JSON: {}'.format(e))

    def to_representation(self, value):
        return value
