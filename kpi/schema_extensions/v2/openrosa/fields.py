from rest_framework import serializers


class OpenRosaFileRequestField(serializers.JSONField):
    pass


class OpenRosaFormHubField(serializers.JSONField):
    pass


class OpenRosaMetaField(serializers.JSONField):
    pass


class OpenRosaManifestURLField(serializers.URLField):
    pass


class OpenRosaXFormField(serializers.JSONField):
    pass

