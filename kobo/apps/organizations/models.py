import uuid

from django.db import models
from kpi.fields import KpiUidField

from organizations.abstract import (AbstractOrganization,
                                    AbstractOrganizationInvitation,
                                    AbstractOrganizationOwner,
                                    AbstractOrganizationUser)


class Organization(AbstractOrganization):
    uid = KpiUidField(uid_prefix='org')

    @property
    def email(self):
        """
        This exists to make dj-stripe happy
        """
        return self.owner.organization_user.user.emailaddress_set.get(
            primary=True,
            verified=True
        )


class OrganizationUser(AbstractOrganizationUser):
    pass


class OrganizationOwner(AbstractOrganizationOwner):
    pass


class OrganizationInvitation(AbstractOrganizationInvitation):
    pass
