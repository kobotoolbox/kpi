from rest_framework import serializers


class InviteField(serializers.JSONField):
    pass


class MemberUrlField(serializers.JSONField):
    pass


class RoleChoiceField(serializers.CharField):
    pass


class UserUrlField(serializers.JSONField):
    pass
