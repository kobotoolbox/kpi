from rest_framework import serializers


class ContentField(serializers.SerializerMethodField):
    pass


class ContentHashField(serializers.ReadOnlyField):
    pass


class DateDeployedField(serializers.SerializerMethodField):
    pass


class DateModifiedField(serializers.ReadOnlyField):
    pass


class UidField(serializers.ReadOnlyField):
    pass


class UrlField(serializers.SerializerMethodField):
    pass
