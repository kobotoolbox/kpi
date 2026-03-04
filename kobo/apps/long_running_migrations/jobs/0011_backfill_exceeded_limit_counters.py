from django.conf import settings
from django.db.models.query import QuerySet

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.limit_enforcement import check_exceeded_limit

if settings.STRIPE_ENABLED:
    from kobo.apps.stripe.models import ExceededLimitCounter


def process_user(user_id, username):
    if not User.objects.filter(pk=user_id).exists():
        print(f'Race condition catched: User(pk={user_id}) no longer exists')
        return 0

    print(f'Checking exceeded limits for {username}...')
    counter = ExceededLimitCounter.objects.filter(
        user_id=user_id,
        limit_type=UsageType.STORAGE_BYTES,
    ).first()

    user = User.objects.get(pk=user_id)
    if counter is None:
        counter = check_exceeded_limit(user, UsageType.STORAGE_BYTES)
    user.extra_details.data['done_storage_limits_check'] = True
    user.extra_details.save()

    return 1 if counter is None else 0


def get_queryset(from_user_pk: int) -> QuerySet:
    users = (
        User.objects.order_by('pk')
        .filter(
            pk__gt=from_user_pk,
            # Filter organization owners only
            organizations_organizationuser__organizationowner__id__isnull=False,
            # Filter out users that already went through the exceeded limits check
            extra_details__data__done_storage_limits_check__isnull=True,
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

    created_counters = 0
    last_pk = 0
    while True:
        users = get_queryset(last_pk)
        users_count = len(users)
        if users_count == 0:
            break
        print(f'Processing {users_count} users from {last_pk}')
        last_pk = users[users_count - 1]['id']

        for user in users:
            result = process_user(user['id'], user['username'])
            if type(result) is int:
                created_counters += result

    print(f'Done. Created {created_counters} counters.')
