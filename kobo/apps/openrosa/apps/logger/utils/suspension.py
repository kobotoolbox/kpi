import time
from contextlib import contextmanager
from uuid import uuid4

from django.conf import settings
from django_redis import get_redis_connection
from redis.exceptions import LockNotOwnedError, RedisError

from kpi.utils.log import logging
from ...main.models import UserProfile
from ..constants import SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX


def release_orphaned_suspensions() -> list[str]:
    """
    Release the profiles left suspended by holders which died before
    releasing them, and return their usernames.
    """
    redis_client = get_redis_connection()
    lease = settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT
    suspended = UserProfile.objects.filter(submissions_suspended=True).values_list(
        'user__username', flat=True
    )
    orphaned = []
    for username in list(suspended):
        holders_key = f'{SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX}{username}'
        with _mutex(redis_client, holders_key):
            if _live_holders(redis_client, holders_key, lease):
                continue
            UserProfile.objects.filter(user__username=username).update(
                submissions_suspended=False
            )
        orphaned.append(username)
    return orphaned


@contextmanager
def suspend_submissions(user: settings.AUTH_USER_MODEL):
    """
    Block incoming submissions for `user`'s forms while the wrapped block
    runs.

    Sets `UserProfile.submissions_suspended`, which makes
    `Instance.check_active()` reject submissions with
    `TemporarilyUnavailableError` (clients retry later).

    Concurrent holders (e.g. several projects of the same owner deleted at
    once) each register a token: only the last one to finish releases the
    flag. Tokens older than the lease are treated as dead holders, so a block
    which may run longer than the lease must call the yielded `heartbeat()`
    regularly. `release_orphaned_suspensions()` cleans up after holders which
    died before releasing.
    """
    redis_client = get_redis_connection()
    holders_key = f'{SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX}{user.username}'
    lease = settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT
    token = uuid4().hex

    def heartbeat():
        _register_holder(redis_client, holders_key, token, lease)

    try:
        # Redis first: if it fails, nothing has been suspended yet
        with _mutex(redis_client, holders_key):
            heartbeat()
            UserProfile.objects.get_or_create(user_id=user.pk)
            _set_flag(user, True)
        yield heartbeat
    finally:
        _release_holder(redis_client, holders_key, token, lease, user)


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


@contextmanager
def _mutex(redis_client, holders_key: str):
    """
    Serialize the registrations and releases of one user's holders, so a
    release cannot clear the flag under a holder registering at the same time.

    Runs the block unlocked when the lock cannot be acquired in time: the race
    it prevents is narrower than a deletion failing on its bookkeeping.
    """
    ttl = settings.SUBMISSIONS_SUSPENSION_LOCK_TTL
    lock = redis_client.lock(
        f'{holders_key}:lock', timeout=ttl, sleep=0.05, blocking_timeout=3 * ttl
    )
    if not (acquired := lock.acquire()):
        logging.error(f'Could not acquire {lock.name}, proceeding unlocked')
    try:
        yield
    finally:
        if acquired:
            try:
                lock.release()
            except LockNotOwnedError:
                # Expired and taken over meanwhile
                pass


def _register_holder(redis_client, holders_key: str, token: str, lease: int):
    pipe = redis_client.pipeline()
    pipe.hset(holders_key, mapping={token: int(time.time())})
    # Backstop so a hash of dead tokens does not outlive its owner's holders
    pipe.expire(holders_key, lease)
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
    collect data until `release_orphaned_suspensions()` runs is not.
    """
    try:
        with _mutex(redis_client, holders_key):
            redis_client.hdel(holders_key, token)
            if _live_holders(redis_client, holders_key, lease):
                return
            _set_flag(user, False)
    except RedisError:
        logging.error(
            f'Redis unavailable while releasing submissions of user'
            f' #{user.pk}, released unconditionally'
        )
        _set_flag(user, False)


def _set_flag(user: settings.AUTH_USER_MODEL, suspended: bool):
    UserProfile.objects.filter(user_id=user.pk).update(submissions_suspended=suspended)
