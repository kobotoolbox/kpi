import time
from unittest.mock import patch

import fakeredis
from django.conf import settings
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import (
    SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY,
    SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX,
)
from kobo.apps.openrosa.apps.logger.utils.suspension import suspend_submissions
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

    def test_redis_failure_leaves_submissions_open(self):
        with patch(REDIS_PATCH_TARGET, side_effect=ConnectionError):
            with self.assertRaises(ConnectionError):
                with suspend_submissions(self.user):
                    pass

        assert not UserProfile.objects.filter(
            user=self.user, submissions_suspended=True
        ).exists()

    def _has_heartbeat(self):
        return self.redis_client.hexists(SUBMISSIONS_SUSPENDED_HEARTBEAT_KEY, 'holder')

    def _is_suspended(self):
        return UserProfile.objects.get(user=self.user).submissions_suspended
