from rest_framework import serializers

from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
)


class FieldFields(serializers.ListField):
    pass


class SourceField(RelativePrefixHyperlinkedRelatedField):
    pass


class SourceNameField(serializers.SerializerMethodField):
    pass


class URLField(serializers.URLField):
    pass
