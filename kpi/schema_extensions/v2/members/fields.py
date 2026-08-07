from rest_framework import serializers

from .schema import ROLE_CHOICES_ENUM


class InviteField(serializers.JSONField):
    pass


class MemberUrlField(serializers.JSONField):
    pass


RoleChoiceField = serializers.ChoiceField(
    choices=ROLE_CHOICES_ENUM, allow_null=False, allow_blank=False
)


class RoleChoicePayloadField(serializers.CharField):
    pass


class UserUrlField(serializers.JSONField):
    pass
