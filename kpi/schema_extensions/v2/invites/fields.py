from rest_framework import serializers


class InviteesField(serializers.ListField):
    pass


class InviteUrlField(serializers.URLField):
    pass


class InvitedByUrlField(serializers.URLField):
    pass
