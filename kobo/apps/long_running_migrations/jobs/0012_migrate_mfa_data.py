import concurrent.futures

from allauth.mfa.adapter import get_adapter
from django.conf import settings
from django.db.models.query import QuerySet

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.limit_enforcement import check_exceeded_limit

if settings.STRIPE_ENABLED:
    from kobo.apps.stripe.models import ExceededLimitCounter

CHUNK_SIZE = 1000


def process_user(adapter, user_id, username):
    print(f'Migrating MFA data for user {username}...')
    user = User.objects.get(id=user_id)
    result = adapter.migrate_user(user)
    return 1 if result is not None else 0


def get_queryset(from_user_pk: int) -> QuerySet:
    users = (
        User.objects.order_by('pk')
        .filter(
            pk__gt=from_user_pk,
            # Filter users with trench data and without allauth mfa data
            mfa_methods__is_active=True,
            mfa_methods_wrapper__id__isnull=True,
        )
        .values('id', 'username')[:CHUNK_SIZE]
    )

    return users


def run():
    """
    Checks exceeded storage limits on all users for the STORAGE_BYTES usage type
    """
    if not settings.STRIPE_ENABLED:
        print('Nothing to do because Stripe is disabled.')
        return

    migrated_users = 0
    last_pk = 0
    adapter = get_adapter()
    while True:
        users = get_queryset(last_pk)
        if not users:
            break

        users_count = len(users)
        last_pk = users[users_count - 1]['id']
        # Let concurrent library automatically decide the number of workers
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(process_user, adapter, user['id'], user['username'])
                for user in users
            ]

        for future in futures:
            result = future.result()
            if type(result) is int:
                migrated_users += result

    print(f'Done. Migrated {migrated_users} users with Trench MFA data.')
