import time
from contextlib import contextmanager

from django.conf import settings
from django_redis import get_redis_connection

from ...main.models import UserProfile
from ..constants import SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY


@contextmanager
def suspend_submissions(user: settings.AUTH_USER_MODEL):
    """
    Block incoming submissions for `user`'s forms while the wrapped block
    runs.

    Sets `UserProfile.submissions_suspended`, which makes
    `Instance.check_active()` reject submissions with
    `TemporarilyUnavailableError` (clients retry later), and registers a
    heartbeat so `fix_stale_submissions_suspended_flag` only releases the
    flag if this process dies before the `finally` block runs.
    """
    UserProfile.objects.get_or_create(user_id=user.pk)
    UserProfile.objects.filter(user_id=user.pk).update(submissions_suspended=True)
    redis_client = get_redis_connection()
    redis_client.hset(
        SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY,
        mapping={user.username: int(time.time())},
    )
    try:
        yield
    finally:
        UserProfile.objects.filter(user_id=user.pk).update(submissions_suspended=False)
        redis_client.hdel(SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, user.username)
