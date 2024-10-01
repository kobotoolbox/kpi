# coding: utf-8
import json

from rest_framework import serializers


class JsonField(serializers.Field):

    def to_representation(self, value):
        if isinstance(value, str):
            return json.loads(value)

        return value

    def to_internal_value(self, value):
        if isinstance(value, str):
            return json.loads(value)

        return value

    @classmethod
    def to_json(cls, data):
        if isinstance(data, str):
            return json.loads(data)
        return data
