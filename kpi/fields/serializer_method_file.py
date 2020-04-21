# coding: utf-8
from rest_framework import serializers


class SerializerMethodFileField(serializers.FileField):
    """
    A `FileField` that gets its representation from calling a method on the
    parent serializer class, like a `SerializerMethodField`. The method called
    will be of the form "get_{field_name}", and should take a single argument,
    which is the object being serialized.
    """
    def __init__(self, *args, **kwargs):
        self._serializer_method_field = serializers.SerializerMethodField()
        super().__init__(*args, **kwargs)

    def bind(self, *args, **kwargs):
        self._serializer_method_field.bind(*args, **kwargs)
        super().bind(*args, **kwargs)

    def to_representation(self, obj):
        return self._serializer_method_field.to_representation(obj.instance)
