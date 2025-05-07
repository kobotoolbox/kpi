from rest_framework import serializers


class OpenRosaMetaField(serializers.JSONField):
    pass

class OpenRosaFormHubField(serializers.JSONField):
    pass

class OpenRosaXFormField(serializers.JSONField):
    pass

class OpenRosaFileRequestField(serializers.JSONField):
    pass
