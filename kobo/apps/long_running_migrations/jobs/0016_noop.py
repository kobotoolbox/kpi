from collections import defaultdict

from django.db import transaction
from django.db.models import Count

from kobo.apps.organizations.models import OrganizationOwner, OrganizationUser
from kobo.apps.organizations.utils import revoke_org_asset_perms
from kobo.apps.organizations.tasks import transfer_member_data_ownership_to_org
from kpi.utils.log import logging

def run():
    """
    Does nothing, just to keep jobs numbers in sync with migrations
    """

    pass
