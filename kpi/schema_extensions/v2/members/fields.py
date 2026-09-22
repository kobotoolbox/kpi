from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .schema import ROLE_CHOICES_ENUM


class InviteField(serializers.JSONField):
    pass


class MemberUrlField(serializers.JSONField):
    pass


@extend_schema_field(
    {
        'allOf': [{'$ref': '#/components/schemas/MemberRoleEnum'}],
        'nullable': True,
    }
)
class NullableRoleChoiceField(serializers.ChoiceField):
    pass


RoleChoiceField = NullableRoleChoiceField(
    choices=ROLE_CHOICES_ENUM, allow_null=True, allow_blank=True
)


class RoleChoicePayloadField(serializers.CharField):
    pass


class UserUrlField(serializers.JSONField):
    pass
