import uuid

from django.db import models
from kpi.fields import KpiUidField

from organizations.abstract import (AbstractOrganization,
                                    AbstractOrganizationInvitation,
                                    AbstractOrganizationOwner,
                                    AbstractOrganizationUser)


class Organization(AbstractOrganization):
    uid = KpiUidField(uid_prefix='org')


class OrganizationUser(AbstractOrganizationUser):
    pass


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass
