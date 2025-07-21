from rest_framework import serializers


class InviteUrlField(serializers.URLField):
    pass


class InvitedByUrlField(serializers.URLField):
    pass

