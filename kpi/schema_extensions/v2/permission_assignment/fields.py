from rest_framework import serializers

from kpi.fields import (
    RelativePrefixHyperlinkedRelatedField,
)


class LabelField(serializers.SerializerMethodField):
    pass


class PartialPermissionField(serializers.SerializerMethodField):
    pass


class PermissionField(RelativePrefixHyperlinkedRelatedField):
    pass


class UrlField(serializers.SerializerMethodField):
    pass


class UserField(RelativePrefixHyperlinkedRelatedField):
    pass
