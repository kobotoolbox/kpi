from rest_framework import serializers


class AssetListField(serializers.ListField):
    pass


class TagUrlField(serializers.URLField):
    pass


class ParentUrlField(serializers.URLField):
    pass
