from rest_framework import serializers

from kobo.apps.organizations.models import OrganizationInviteStatusChoices
from ..members.schema import ROLE_CHOICES_PAYLOAD_ENUM


class InviteesRoleEnumField(serializers.CharField):
    pass


class InviteesField(serializers.ListField):
    pass


class InviteUrlField(serializers.URLField):
    pass


class InvitedByUrlField(serializers.URLField):
    pass


InviteRoleField = serializers.ChoiceField(
    choices=ROLE_CHOICES_PAYLOAD_ENUM, allow_null=False, allow_blank=False
)


InviteStatusField = serializers.ChoiceField(
    choices=OrganizationInviteStatusChoices.choices, allow_null=False, allow_blank=False
)
