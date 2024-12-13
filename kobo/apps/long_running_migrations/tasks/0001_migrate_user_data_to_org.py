# 2024-12-13
from django.db.models import Count

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.tasks import transfer_member_data_ownership_to_org
from kpi.models.asset import Asset


def task():
    organizations = Organization.objects.only('id').annotate(
        count=Count('organization_users')
    ).filter(count__gt=1)
    for organization in organizations:
        for user in organization.users.all():
            if user.is_org_owner(organization):
                continue

            if not Asset.objects.filter(owner=user).exists():
                continue

            transfer_member_data_ownership_to_org(user.pk)
