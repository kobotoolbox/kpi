from kobo.apps.stripe.utils.limit_enforcement import check_exceeded_limit

PERM_FROM_KC_ONLY = 'from_kc_only'
from kobo.apps.organizations.constants import UsageType


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
    for user in users:
        counter = ExceededLimitCounter.objects.filter(
            user=user,
            limit_type=usage_type,
        ).first()
        if counter is None:
            print(f'Checking exceeded limits for {user.username}.')
            created_counters += 1
            check_exceeded_limit(user, UsageType.STORAGE_BYTES)
    print(f'Done. Created {created_counters} counters.')
