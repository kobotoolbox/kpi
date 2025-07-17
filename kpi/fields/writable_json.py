# coding: utf-8
import json

from django.utils.translation import gettext as t
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


@extend_schema_field(OpenApiTypes.OBJECT)
class WritableJSONField(serializers.Field):
    """
    Serializer for JSONField -- required to make field writable
    """

    def __init__(self, **kwargs):
        self.allow_blank = kwargs.pop('allow_blank', False)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        # If data is sent to serializer as `dict`, not `str`
        # Return as is (e.g. `data` is equals `{}`)
        if isinstance(data, dict):
            return data

        if (not data) and (not self.required):
            return None
        else:
            try:
                return json.loads(data)
            except Exception as e:
                raise serializers.ValidationError(
                    t('Unable to parse JSON: {error}').format(error=e)
                )

    def to_representation(self, value):
        return value
