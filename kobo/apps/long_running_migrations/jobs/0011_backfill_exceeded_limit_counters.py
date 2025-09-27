import concurrent.futures

from django.conf import settings
from django.db.models.query import QuerySet

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.limit_enforcement import check_exceeded_limit

if settings.STRIPE_ENABLED:
    from kobo.apps.stripe.models import ExceededLimitCounter

CHUNK_SIZE = 1000


def process_user(user_id, username):
    counter = ExceededLimitCounter.objects.filter(
        user_id=user_id,
        limit_type=UsageType.STORAGE_BYTES,
    ).first()
    if counter is None:
        print(f'Checking exceeded limits for {username}...')
        user = User.objects.get(pk=user_id)
        counter = check_exceeded_limit(user, UsageType.STORAGE_BYTES)
        return 1 if counter else 0


def get_queryset(from_user_pk: int) -> QuerySet:
    users = (
        User.objects.order_by('pk')
        .filter(
            pk__gt=from_user_pk,
            # Filter organization admins
            organizations_organizationuser__is_admin=True,
        )
        .values('id', 'username')[:CHUNK_SIZE]
    )

    return users


def run():
    """
    Checks exceeded storage limits on all users
    """
    if not settings.STRIPE_ENABLED:
        print('Nothing to do because Stripe is disabled.')
        return

    created_counters = 0
    last_pk = 0
    while True:
        users = get_queryset(last_pk)
        if not users:
            break

        users_count = len(users)
        last_pk = users[users_count - 1]['id']
        # Let concurrent library automatically decide the number of workers
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(process_user, user['id'], user['username'])
                for user in users
            ]

        for future in futures:
            result = future.result()
            if type(result) is int:
                created_counters += result

    print(f'Done. Created {created_counters} counters.')
