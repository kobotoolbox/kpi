import time
from unittest.mock import Mock, patch

import fakeredis
from django.conf import settings
from django.test import TestCase
from redis.exceptions import ConnectionError as RedisConnectionError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import (
    SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY,
    SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX,
)
from kobo.apps.openrosa.apps.logger.utils.suspension import (
    release_orphaned_suspensions,
    suspend_submissions,
)
from kobo.apps.openrosa.apps.main.models import UserProfile

REDIS_PATCH_TARGET = (
    'kobo.apps.openrosa.apps.logger.utils.suspension.get_redis_connection'
)


class SuspendSubmissionsTestCase(TestCase):

    def setUp(self):
        self.user = User.objects.create(username='holder')
        self.redis_client = fakeredis.FakeStrictRedis()
        patcher = patch(REDIS_PATCH_TARGET, return_value=self.redis_client)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.holders_key = f'{SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX}holder'

    def test_suspends_then_releases(self):
        with suspend_submissions(self.user):
            assert self._is_suspended()
            assert self._has_heartbeat()

        assert not self._is_suspended()
        assert not self._has_heartbeat()
        assert not self.redis_client.exists(self.holders_key)

    def test_first_holder_to_finish_does_not_release(self):
        first = suspend_submissions(self.user)
        second = suspend_submissions(self.user)
        first.__enter__()
        second.__enter__()

        first.__exit__(None, None, None)
        assert self._is_suspended()
        assert self._has_heartbeat()

        second.__exit__(None, None, None)
        assert not self._is_suspended()
        assert not self._has_heartbeat()

    def test_dead_holder_does_not_pin_the_flag(self):
        expired = int(time.time()) - settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT
        self.redis_client.hset(self.holders_key, mapping={'dead': expired})

        with suspend_submissions(self.user):
            pass

        assert not self._is_suspended()
        assert not self.redis_client.exists(self.holders_key)

    def test_redis_failure_on_entry_leaves_submissions_open(self):
        with patch(REDIS_PATCH_TARGET, side_effect=RedisConnectionError):
            with self.assertRaises(RedisConnectionError):
                with suspend_submissions(self.user):
                    pass

        assert not UserProfile.objects.filter(
            user=self.user, submissions_suspended=True
        ).exists()

    def test_redis_failure_on_exit_still_releases(self):
        with suspend_submissions(self.user):
            assert self._is_suspended()
            self.redis_client.hdel = Mock(side_effect=RedisConnectionError)

        assert not self._is_suspended()

    def test_heartbeat_refreshes_the_lease(self):
        lease = settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT
        with suspend_submissions(self.user) as heartbeat:
            (token,) = self.redis_client.hkeys(self.holders_key)
            self.redis_client.hset(self.holders_key, token, int(time.time()) - lease)
            heartbeat()
            registered_at = int(self.redis_client.hget(self.holders_key, token))
            assert registered_at >= int(time.time()) - 1

        assert not self._is_suspended()

    def test_expired_mutex_does_not_block(self):
        self.redis_client.set(f'{self.holders_key}:lock', 'dead-worker', ex=1)

        with suspend_submissions(self.user):
            assert self._is_suspended()

        assert not self._is_suspended()
        assert not self.redis_client.exists(f'{self.holders_key}:lock')

    def test_release_orphaned_suspensions_keeps_live_holders(self):
        orphan = User.objects.create(username='orphan')
        UserProfile.objects.create(user=orphan, submissions_suspended=True)
        self.redis_client.hset(
            SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, mapping={'orphan': int(time.time())}
        )

        with suspend_submissions(self.user):
            assert release_orphaned_suspensions() == ['orphan']
            assert self._is_suspended()
            assert self._has_heartbeat()

        assert not UserProfile.objects.get(user=orphan).submissions_suspended
        assert not self.redis_client.hexists(
            SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, 'orphan'
        )

    def _has_heartbeat(self):
        return self.redis_client.hexists(SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, 'holder')

    def _is_suspended(self):
        return UserProfile.objects.get(user=self.user).submissions_suspended
