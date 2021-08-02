# coding: utf-8
from rest_framework import serializers


class ReadOnlyJSONField(serializers.ReadOnlyField):
    def to_representation(self, value):
        return value
