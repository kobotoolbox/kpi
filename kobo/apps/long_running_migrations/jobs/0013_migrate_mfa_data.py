from allauth.mfa.adapter import get_adapter
from django.conf import settings
from django.db.models.query import QuerySet

from kobo.apps.kobo_auth.shortcuts import User


def process_user(adapter, user_id, username):
    print(f'Migrating MFA data for user {username}...')
    if not User.objects.filter(pk=user_id).exists():
        print(f'Race condition catched: User(pk={user_id}) no longer exists')
        return 0

    user = User.objects.get(pk=user_id)
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
        .values('id', 'username')[:settings.LONG_RUNNING_MIGRATION_BATCH_SIZE]
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
        users_count = len(users)
        if users_count == 0:
            break
        print(f'Processing {users_count} users from {last_pk}')
        last_pk = users[users_count - 1]['id']

        for user in users:
            result = process_user(adapter, user['id'], user['username'])
            migrated_users += result

    print(f'Done. Migrated {migrated_users} users with Trench MFA data.')
