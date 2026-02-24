from django.db.models import Count

from kobo.apps.organizations.models import Organization
from kpi.utils.log import logging

CHUNK_SIZE = 1000


def run():
    """
    Removes organizations that are exclusively owned by removed/inactive users
    and contain no other members
    """
    logging.info('Starting cleanup of useless organizations..')

    while True:
        org_ids = list(
            Organization.objects.filter(
                owner__organization_user__user__is_active=False,
                owner__organization_user__user__extra_details__date_removed__isnull=False  # noqa
            ).annotate(
                user_count=Count('organization_users')
            ).filter(
                user_count=1
            ).values_list('pk', flat=True)[:CHUNK_SIZE]
        )

        if not org_ids:
            logging.info('No more organizations to delete. Cleanup complete.')
            break

        # Delete the batch
        logging.info(f'Deleting batch of {len(org_ids)} organizations...')
        Organization.objects.filter(pk__in=org_ids).delete()
