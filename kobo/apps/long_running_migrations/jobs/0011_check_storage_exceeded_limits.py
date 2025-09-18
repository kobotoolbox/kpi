import concurrent.futures

from django.conf import settings

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.limit_enforcement import check_exceeded_limit

if settings.STRIPE_ENABLED:
    from kobo.apps.stripe.models import ExceededLimitCounter


def process_user(user_id, username):
    counter = ExceededLimitCounter.objects.filter(
        user_id=user_id,
        limit_type=UsageType.STORAGE_BYTES,
    ).first()
    if counter is None:
        print(f'Checking exceeded limits for {username}.')
        user = User.objects.get(pk=user_id)
        counter = check_exceeded_limit(user, UsageType.STORAGE_BYTES)
        return 1 if counter else 0


def run():
    """
    Checks exceeded storage limits on all users
    """
    if not settings.STRIPE_ENABLED:
        print(f'Stripe is disabled')
        return
    created_counters = 0
    users = User.objects.all()
    print(
        f'Checking exceeded limits for {users.count()} users. This may take a while...'
    )
    with concurrent.futures.ThreadPoolExecutor() as executor:
        print(f'Using {executor._max_workers} concurrent workers')
        futures = [
            executor.submit(process_user, user.pk, user.username) for user in users
        ]

    total_instances = 0
    for future in futures:
        result = future.result()
        if type(result) is int:
            created_counters += result

    print(f'Done. Created {created_counters} counters.')
