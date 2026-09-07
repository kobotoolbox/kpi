import time
from contextlib import contextmanager
from uuid import uuid4

from django.conf import settings
from django_redis import get_redis_connection
from redis.exceptions import RedisError

from kpi.utils.log import logging
from ...main.models import UserProfile
from ..constants import (
    SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY,
    SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX,
)


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

    Concurrent holders (e.g. several projects of the same owner deleted at
    once) each register a token: only the last one to finish releases the
    flag. Tokens older than the lease are treated as dead holders.

    The flag and heartbeat are shared with `update_attachment_storage_bytes`,
    which releases them unconditionally when it finishes.
    """
    redis_client = get_redis_connection()
    holders_key = f'{SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX}{user.username}'
    lease = settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT
    token = uuid4().hex

    # Redis first: if it fails, nothing has been suspended yet
    _register_holder(redis_client, holders_key, token, lease, user.username)
    try:
        UserProfile.objects.get_or_create(user_id=user.pk)
        _set_flag(user, True)
        yield
    finally:
        _release_holder(redis_client, holders_key, token, lease, user)


def _heartbeat(redis_client, username: str):
    redis_client.hset(
        SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, mapping={username: int(time.time())}
    )


def _live_holders(redis_client, holders_key: str, lease: int) -> int:
    """
    Prune tokens whose lease expired (their process died before releasing)
    and return how many holders are still alive.
    """
    now = int(time.time())
    dead = [
        token
        for token, registered_at in redis_client.hgetall(holders_key).items()
        if int(registered_at) + lease <= now
    ]
    if dead:
        redis_client.hdel(holders_key, *dead)
    return redis_client.hlen(holders_key)


def _register_holder(
    redis_client, holders_key: str, token: str, lease: int, username: str
):
    now = int(time.time())
    pipe = redis_client.pipeline()
    pipe.hset(holders_key, mapping={token: now})
    # Backstop so a hash of dead tokens does not outlive its owner's deletions
    pipe.expire(holders_key, lease)
    pipe.hset(SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, mapping={username: now})
    pipe.execute()


def _release_holder(
    redis_client,
    holders_key: str,
    token: str,
    lease: int,
    user: settings.AUTH_USER_MODEL,
):
    """
    Drop this holder's token and release the flag if no live holder remains.

    Without Redis there is no way to tell whether another holder is alive, so
    the flag is released anyway: a deadlock is retryable, an owner who cannot
    collect data until `fix_stale_submissions_suspended_flag` runs is not.
    """
    try:
        redis_client.hdel(holders_key, token)
        if _live_holders(redis_client, holders_key, lease):
            return
    except RedisError:
        logging.error(
            f'Redis unavailable while releasing submissions of user'
            f' #{user.pk}, released unconditionally'
        )
        _set_flag(user, False)
        return

    _set_flag(user, False)
    redis_client.hdel(SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, user.username)
    # A holder registered between the check and the release above would be
    # left unprotected. Its flag can still dip for the few round-trips before
    # this restore: the deadlock it opens is the retryable one this suspension
    # narrows, not a new failure
    if redis_client.hlen(holders_key):
        _set_flag(user, True)
        _heartbeat(redis_client, user.username)


def _set_flag(user: settings.AUTH_USER_MODEL, suspended: bool):
    UserProfile.objects.filter(user_id=user.pk).update(submissions_suspended=suspended)
