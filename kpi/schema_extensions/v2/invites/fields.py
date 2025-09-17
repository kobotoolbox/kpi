from rest_framework import serializers


class InviteesRoleEnumField(serializers.CharField):
    pass


class InviteesField(serializers.ListField):
    pass


class InviteUrlField(serializers.URLField):
    pass


class InvitedByUrlField(serializers.URLField):
    pass


class InviteRoleField(serializers.CharField):
    pass
