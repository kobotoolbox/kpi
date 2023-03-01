import uuid

from django.db import models
from kpi.fields import KpiUidField
from django.forms.fields import EmailField

from organizations.abstract import (AbstractOrganization,
                                    AbstractOrganizationInvitation,
                                    AbstractOrganizationOwner,
                                    AbstractOrganizationUser)


class Organization(AbstractOrganization):
    uid = KpiUidField(uid_prefix='org')

    @property
    def email(self):
        billing_contact = self.owner.organization_user.user
        return billing_contact.email

class OrganizationUser(AbstractOrganizationUser):
    pass


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass
