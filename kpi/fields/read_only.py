# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from rest_framework import serializers


class ReadOnlyJSONField(serializers.ReadOnlyField):
    def to_representation(self, value):
        return value
