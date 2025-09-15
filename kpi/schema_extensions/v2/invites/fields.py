from rest_framework import serializers
from kobo.apps.organizations.models import OrganizationInviteStatusChoices
from kobo.apps.organizations.constants import (
    ORG_ADMIN_ROLE,
    ORG_MEMBER_ROLE,
)


class InviteesRoleEnumField(serializers.CharField):
    pass


class InviteesField(serializers.ListField):
    pass


class InviteUrlField(serializers.URLField):
    pass


class InvitedByUrlField(serializers.URLField):
    pass


InviteRoleField = serializers.ChoiceField(
    choices=[ORG_ADMIN_ROLE, ORG_MEMBER_ROLE],
    default=ORG_MEMBER_ROLE,
)


InviteStatusField = serializers.ChoiceField(
    choices=OrganizationInviteStatusChoices.choices,
    default=OrganizationInviteStatusChoices.PENDING,
)
