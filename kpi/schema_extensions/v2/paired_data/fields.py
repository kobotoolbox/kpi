from rest_framework import serializers

from kpi.fields import RelativePrefixHyperlinkedRelatedField


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
