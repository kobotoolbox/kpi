import uuid
from functools import partial

from django.conf import settings
from django.db import models
from django.forms.fields import EmailField
from organizations.abstract import (
    AbstractOrganization,
    AbstractOrganizationInvitation,
    AbstractOrganizationOwner,
    AbstractOrganizationUser,
)
from organizations.utils import create_organization as create_organization_base

from kpi.fields import KpiUidField


class Organization(AbstractOrganization):
    id = KpiUidField(uid_prefix='org', primary_key=True)
    is_org_admin = AbstractOrganization.is_admin

    @property
    def email(self):
        """
        As organization is our customer model for Stripe, Stripe requires that
        it has an email address attribute
        """
        return self.owner.organization_user.user.email


class OrganizationUser(AbstractOrganizationUser):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        blank=True,
        null=True,
        on_delete=models.CASCADE,
    )
    email = models.EmailField(
        blank=True, null=True, help_text='Email for pending invite'
    )

    def __str__(self):
        name = str(self.user) if self.user else self.email
        return f"{name} {self.organization}"

    def is_org_admin(self, user):
        return self.organization.is_admin(user)

    @property
    def is_active(self):
        return self.user_id is not None


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass


create_organization = partial(create_organization_base, model=Organization)
