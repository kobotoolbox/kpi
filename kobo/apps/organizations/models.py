import uuid
from functools import partial

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
    def is_org_admin(self, user):
        return self.organization.is_admin(user)


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass


create_organization = partial(create_organization_base, model=Organization)
