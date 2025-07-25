from rest_framework import serializers


class ServicesField(serializers.JSONField):
    pass


class LanguageUrlField(serializers.URLField):
    pass
