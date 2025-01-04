# Generated on 2024-12-19 14:54
from django.db.models import Count, OuterRef

from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.tasks import transfer_member_data_ownership_to_org
from kpi.models.asset import Asset


def run():
    """
    Transfers all assets owned by members to their respective organizations.
    """

    organizations = Organization.objects.only('id').annotate(
        count=Count('organization_users')
    ).filter(count__gt=1)
    for organization in organizations:
        for user in organization.users.filter(
            pk__in=Asset.objects.values_list('owner_id', flat=True).filter(
                owner_id=OuterRef('pk')
            )
        ).exclude(pk=organization.owner_user_object.pk):
            transfer_member_data_ownership_to_org(user.pk)
