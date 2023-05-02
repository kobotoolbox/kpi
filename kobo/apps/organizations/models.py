import uuid

from django.db import models
from kpi.fields import KpiUidField
from django.forms.fields import EmailField

from organizations.abstract import (AbstractOrganization,
                                    AbstractOrganizationInvitation,
                                    AbstractOrganizationOwner,
                                    AbstractOrganizationUser)


class Organization(AbstractOrganization):
    id = KpiUidField(uid_prefix='org', primary_key=True)

    @property
    def email(self):
        """
        As organization is our customer model for Stripe, Stripe requires that
        it has an email address attribute
        """
        return self.owner.organization_user.user.email

class OrganizationUser(AbstractOrganizationUser):
    pass


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass
