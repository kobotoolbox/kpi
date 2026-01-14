from collections import defaultdict
import logging

from django.db import transaction
from django.db.models import Count

from kobo.apps.organizations.models import (
    OrganizationUser,
    OrganizationOwner
)
from kobo.apps.organizations.utils import revoke_org_asset_perms
from kpi.utils.log import logging

CHUNK_SIZE = 200


def get_newest_org(orgs):
    """
    Return the org with the most recent creation date
    """
    return max(orgs, key=lambda o: getattr(o, 'created'))


def has_active_subscription(org):
    """
    Check if org has an active subscription
    """
    try:
        return org.active_subscription_billing_details() is not None
    except Exception:
        return False


def is_effective_mmo(org):
    """
    Determine if org is an effective MMO
    """
    if org.is_mmo:
        return True

    # Edge case:
    # `mmo_override` is False, but org has multiple members and active subscription
    member_count = org.organization_users.count()
    return member_count > 1


def fetch_duplicate_users(chunk_size=CHUNK_SIZE):
    """
    Find users associated with multiple organizations
    """
    return (
        OrganizationUser.objects.values('user')
        .annotate(org_count=Count('organization_id', distinct=True))
        .filter(org_count__gt=1)
        .order_by('user')[:chunk_size]
    )


def fetch_org_users(user_ids):
    """
    Fetch all OrganizationUser rows for given users
    """
    return (
        OrganizationUser.objects.filter(user_id__in=user_ids)
        .select_related('organization')
        .order_by('user_id')
    )


def run():
    """
    Remove duplicate organizations per user, keeping one based on rules
    """
    total_processed = 0

    while True:
        duplicate_users = fetch_duplicate_users()
        if not duplicate_users:
            logging.info('No more duplicate users to process.')
            break

        user_ids = [u['user'] for u in duplicate_users]
        org_user_rows = fetch_org_users(user_ids)

        # Map users to their organizations
        user_to_orgs = defaultdict(list)
        for ou in org_user_rows:
            user_to_orgs[ou.user_id].append(ou.organization)

        for uid, orgs in user_to_orgs.items():
            mmos = [o for o in orgs if is_effective_mmo(o)]
            if mmos:
                keep = get_newest_org(mmos)
            else:
                actives = [o for o in orgs if has_active_subscription(o)]
                if actives:
                    keep = get_newest_org(actives)
                else:
                    keep = get_newest_org(orgs)

            to_remove = [o for o in orgs if o.id != keep.id]

            for org in to_remove:
                with transaction.atomic():
                    revoke_org_asset_perms(org, [uid])
                    OrganizationUser.objects.filter(organization_id=org.id).delete()
                    OrganizationOwner.objects.filter(organization_id=org.id).delete()
                    org.delete()
                    logging.info(f'Deleted organization {org.id} for user {uid}')

        total_processed += len(user_ids)
        logging.info(f'Processed {total_processed} users so far.')

    logging.info(
        f'Completed processing duplicate organizations. '
        f'Total users processed: {total_processed}'
    )
