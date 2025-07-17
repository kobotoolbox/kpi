from rest_framework import serializers


class DataField(serializers.ListField):
    pass


class FieldFields(serializers.ListField):
    pass


class SourceField(serializers.URLField):
    pass


class SourceNameField(serializers.SerializerMethodField):
    pass


class URLField(serializers.URLField):
    pass
