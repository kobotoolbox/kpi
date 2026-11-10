import uuid
from unittest.mock import patch

import pytest
from constance import config
from constance.test import override_config
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.trash_bin.constants import AUTO_DELETE_CURSOR_KEY
from kobo.apps.trash_bin.tasks.attachment import (
    auto_delete_excess_attachments,
    schedule_auto_attachment_cleanup_for_users,
)
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AttachmentCleanupTestCase(BaseTestCase, AssetSubmissionTestMixin):
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.owner = User.objects.create(username='owner')
        self.asset, self.xform, self.instance, self.owner_profile, self.attachment = (
            self._create_test_asset_and_submission(user=self.owner)
        )
        # The cursor of `schedule_auto_attachment_cleanup_for_users` lives in
        # the cache, do not let it leak from one test to another
        cache.delete(AUTO_DELETE_CURSOR_KEY)
        self.addCleanup(cache.delete, AUTO_DELETE_CURSOR_KEY)

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @requires_stripe
    def test_schedule_cleanup_skips_if_auto_delete_disabled(self, **stripe_models):
        """
        Test that no cleanup tasks are scheduled if AUTO_DELETE_ATTACHMENTS is False
        """
        ExceededLimitCounter = stripe_models['exceeded_limit_counter_model']
        ExceededLimitCounter.objects.create(
            user=self.owner,
            limit_type=UsageType.STORAGE_BYTES,
            days=config.OVER_LIMIT_ATTACHMENT_RETENTION + 1,
        )

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments.delay'
        ) as mock_task:
            schedule_auto_attachment_cleanup_for_users()
            mock_task.assert_not_called()

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_excess_attachments_user_within_limit(self):
        """
        Test that no attachments are deleted if user is under quota
        """
        mock_balances = {
            UsageType.STORAGE_BYTES: {
                'effective_limit': 100000,
                'balance_value': 50000,
                'balance_percent': 50,
                'exceeded': False
            }
        }
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value=mock_balances,
        ):
            auto_delete_excess_attachments(self.owner.pk)
            self.attachment.refresh_from_db()
            self.assertTrue(Attachment.objects.filter(pk=self.attachment.pk).exists())

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_excess_attachments_user_exceeds_limit(self):
        """
        Test that attachments are soft deleted when a user is over quota
        """
        mock_balances = {
            UsageType.STORAGE_BYTES: {
                'effective_limit': 8016257,
                'balance_value': -6319175,
                'balance_percent': 178,
                'exceeded': True
            },
        }
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value=mock_balances,
        ):
            auto_delete_excess_attachments(self.owner.pk)

        # Attachment should be soft-deleted
        self.assertFalse(Attachment.objects.filter(pk=self.attachment.pk).exists())

        # API should now return `is_deleted=True` for this attachment
        self.client.force_login(self.owner)
        submission_detail_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'uid_asset': self.asset.uid,
                'pk': self.instance.pk,
            },
        )
        response = self.client.get(submission_detail_url)
        assert response.status_code == status.HTTP_200_OK
        for attachment in response.data['_attachments']:
            assert attachment['is_deleted'] is True

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_trashes_minimum_attachments_to_meet_limit(self):
        """
        Test only the minimum number of attachments are soft-deleted to bring
        the user within their limit, and no more.
        """
        limit_bytes = 300000

        # Add 3 more attachments
        self._create_submissions_with_attachments(count=3)

        all_attachments = list(
            Attachment.objects.filter(user=self.owner).order_by('pk')
        )
        total_size = sum(att.media_file_size for att in all_attachments)

        # Set up mock balance indicating user is exceeding limit
        mock_balances = {
            UsageType.STORAGE_BYTES: {
                'effective_limit': limit_bytes,
                'balance_value': limit_bytes - total_size,
                'balance_percent': int((total_size / limit_bytes) * 100),
                'exceeded': total_size > limit_bytes
            },
        }
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value=mock_balances,
        ):
            auto_delete_excess_attachments(self.owner.pk)

        # Confirm enough attachments were deleted to get under the limit
        remaining_attachments = Attachment.objects.filter(user=self.owner)
        remaining_size = sum(att.media_file_size for att in remaining_attachments)

        self.assertLessEqual(remaining_size, limit_bytes)
        self.assertEqual(remaining_attachments.count(), 1)

        # Confirm the oldest attachments were deleted and the last one remains
        self.assertEqual(remaining_attachments.first().pk, all_attachments[-1].pk)

        # Re-run the task and ensure no further deletions
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value={
                UsageType.STORAGE_BYTES: {
                    'effective_limit': limit_bytes,
                    'balance_value': limit_bytes - remaining_size,
                    'balance_percent': int((remaining_size / limit_bytes) * 100),
                    'exceeded': remaining_size > limit_bytes
                },
            },
        ):
            auto_delete_excess_attachments(self.owner.pk)
            self.assertEqual(Attachment.objects.filter(user=self.owner).count(), 1)

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @requires_stripe
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_schedule_cleanup_task_only_for_users_exceeding_grace_period(
        self, **stripe_models
    ):
        """
        Test that only users over their limit for more than the grace period are
        scheduled for attachment cleanup
        """
        anotheruser = User.objects.create(username='anotheruser', password='password')
        ExceededLimitCounter = stripe_models['exceeded_limit_counter_model']

        # Qualifying user
        ExceededLimitCounter.objects.create(
            user=self.owner,
            limit_type=UsageType.STORAGE_BYTES,
            days=config.OVER_LIMIT_ATTACHMENT_RETENTION + 1
        )

        # Non-qualifying user (within grace period)
        ExceededLimitCounter.objects.create(
            user=anotheruser,
            limit_type=UsageType.STORAGE_BYTES,
            days=config.OVER_LIMIT_ATTACHMENT_RETENTION - 1
        )

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments.delay'
        ) as mock_task:
            schedule_auto_attachment_cleanup_for_users()
            mock_task.assert_called_once_with(self.owner.pk)

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    @override_settings(AUTO_DELETE_ATTACHMENTS_USERS_PER_RUN=2)
    def test_schedule_cleanup_rotates_users(self):
        """
        Test that each run queues the next users, and starts over from the
        first ones once every user had a turn
        """
        user_ids = self._create_users_over_grace_period(count=5)

        self.assertEqual(self._run_scheduler(), user_ids[0:2])
        self.assertEqual(self._run_scheduler(), user_ids[2:4])
        # Last user alone: the end is reached
        self.assertEqual(self._run_scheduler(), user_ids[4:5])
        self.assertEqual(self._run_scheduler(), user_ids[0:2])

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    @override_settings(AUTO_DELETE_ATTACHMENTS_USERS_PER_RUN=2)
    def test_schedule_cleanup_starts_over_when_cursor_is_past_the_end(self):
        """
        Test that the first users are queued when no counter is left after
        the cursor, e.g. the last counters were removed since the previous run
        """
        user_ids = self._create_users_over_grace_period(count=3)
        cache.set(AUTO_DELETE_CURSOR_KEY, 10**9, None)

        self.assertEqual(self._run_scheduler(), user_ids[0:2])
        self.assertEqual(self._run_scheduler(), user_ids[2:3])

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    @override_settings(AUTO_DELETE_ATTACHMENTS_USERS_PER_RUN=20)
    def test_schedule_cleanup_queues_every_user_when_fewer_than_per_run(self):
        """
        Test that every run queues all the users when there are fewer of them
        than `AUTO_DELETE_ATTACHMENTS_USERS_PER_RUN`
        """
        user_ids = self._create_users_over_grace_period(count=3)

        self.assertEqual(self._run_scheduler(), user_ids)
        self.assertEqual(self._run_scheduler(), user_ids)

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_excess_attachments_ignores_missing_balance_info(self):
        """
        If `ServiceUsageCalculator` returns no info for 'storage_bytes',
        nothing should be deleted
        """
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.ServiceUsageCalculator.get_usage_balances'  # noqa
        ) as mock_usage:
            mock_usage.return_value = {}

            auto_delete_excess_attachments(self.owner.pk)
            self.assertTrue(Attachment.objects.filter(pk=self.attachment.pk).exists())

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_excess_attachments_skips_if_lock_held(self):
        """
        Test that nothing is trashed while another task holds the lock of the
        same user
        """
        lock = cache.lock(self._get_lock_key(), timeout=30)
        self.assertTrue(lock.acquire(blocking=False))
        try:
            self._run_task_over_limit()
        finally:
            lock.release()

        self.assertTrue(Attachment.objects.filter(pk=self.attachment.pk).exists())

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_excess_attachments_releases_lock(self):
        """
        Test that the lock is released once the task is done, even when it
        fails, so that the next run is not blocked
        """
        self._run_task_over_limit()
        self._assert_lock_is_free()

        self._create_submissions_with_attachments(count=1)
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.move_to_trash',
            side_effect=RuntimeError('boom'),
        ):
            with self.assertRaises(RuntimeError):
                self._run_task_over_limit()
        self._assert_lock_is_free()

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=False)
    def test_auto_delete_excess_attachments_skips_if_auto_delete_disabled(self):
        """
        Test that a task already queued does nothing once the feature is
        turned off
        """
        self._run_task_over_limit()
        self.assertTrue(Attachment.objects.filter(pk=self.attachment.pk).exists())

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    @override_settings(AUTO_DELETE_ATTACHMENTS_MAX_PER_USER=2)
    def test_auto_delete_excess_attachments_respects_max_per_user(self):
        """
        Test that no more than `AUTO_DELETE_ATTACHMENTS_MAX_PER_USER`
        attachments are trashed per run, oldest first, and that the next run
        continues with the next oldest ones
        """
        self._create_submissions_with_attachments(count=3)
        all_attachment_ids = list(
            Attachment.objects.filter(user=self.owner)
            .order_by('pk')
            .values_list('pk', flat=True)
        )
        self.assertEqual(len(all_attachment_ids), 4)

        self._run_task_over_limit()
        self.assertEqual(self._get_active_attachment_ids(), all_attachment_ids[2:])

        self._run_task_over_limit()
        self.assertEqual(self._get_active_attachment_ids(), [])

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_excess_attachments_query_count_does_not_grow(self):
        """
        Test that trashing more attachments does not run more queries, i.e.
        nothing is fetched once per attachment
        """
        # Warm up the caches filled by the first run (e.g. content types)
        self._run_task_over_limit()

        self._create_submissions_with_attachments(count=2)
        with CaptureQueriesContext(connection) as two_attachments:
            self._run_task_over_limit()

        self._create_submissions_with_attachments(count=5)
        with CaptureQueriesContext(connection) as five_attachments:
            self._run_task_over_limit()

        self.assertEqual(self._get_active_attachment_ids(), [])
        self.assertEqual(
            len(five_attachments.captured_queries),
            len(two_attachments.captured_queries),
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @requires_stripe
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_auto_delete_excess_attachments_clears_counters_and_cache(
        self, **stripe_models
    ):
        """
        After deleting attachments, the task should clear the usage cache
        and remove the ExceededLimitCounter if the user is no longer exceeding.
        """
        ExceededLimitCounter = stripe_models['exceeded_limit_counter_model']

        # Create a counter for the user
        counter = ExceededLimitCounter.objects.create(
            user=self.owner,
            limit_type=UsageType.STORAGE_BYTES,
            days=config.OVER_LIMIT_ATTACHMENT_RETENTION + 1,
        )
        self.assertTrue(Attachment.objects.filter(pk=self.attachment.pk).exists())

        # Initially, assume user is over quota
        over_quota_balances = {
            UsageType.STORAGE_BYTES: {
                'effective_limit': 1,
                'balance_value': -1,
                'balance_percent': 200,
                'exceeded': True,
            }
        }

        # After cleanup, assume user is under quota
        under_quota_balances = {
            UsageType.STORAGE_BYTES: {
                'effective_limit': 100000,
                'balance_value': 50000,
                'balance_percent': 50,
                'exceeded': False,
            }
        }

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.ServiceUsageCalculator.get_usage_balances',  # noqa
            side_effect=[over_quota_balances, under_quota_balances],
        ):
            auto_delete_excess_attachments(self.owner.pk)

        # Attachment should be deleted
        self.assertFalse(Attachment.objects.filter(pk=self.attachment.pk).exists())

        # Counter should be removed since user is now under limit
        self.assertFalse(
            ExceededLimitCounter.objects.filter(id=counter.id).exists()
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    @override_settings(AUTO_DELETE_ATTACHMENTS_MAX_PER_USER=2)
    def test_auto_delete_excess_attachments_skips_attachments_without_project(self):
        """
        Test that the oldest attachments, when they have no project, do not
        prevent the newer ones from being trashed, even when they fill a whole
        page (the limit per run is 2 here)
        """
        # The attachment of `setUp()` is the oldest one and has a project. Take
        # it out of the way, so that the oldest active attachments are the ones
        # without a project
        Attachment.all_objects.filter(pk=self.attachment.pk).update(
            delete_status=AttachmentDeleteStatus.PENDING_DELETE
        )

        # Oldest attachments: a form created before KPI (no project uid), left
        # out by the query, then two forms whose project cannot be found, which
        # fill the first page and are skipped
        without_project_ids = []
        for kpi_asset_uid in (None, 'aDoesNotExist', 'aDoesNotExistEither'):
            _, xform, _, _, attachment = self._create_test_asset_and_submission(
                user=self.owner
            )
            XForm.objects.filter(pk=xform.pk).update(kpi_asset_uid=kpi_asset_uid)
            without_project_ids.append(attachment.pk)

        self._create_submissions_with_attachments(count=1)
        with_project_ids = [
            pk
            for pk in self._get_active_attachment_ids()
            if pk not in without_project_ids
        ]
        self.assertEqual(len(with_project_ids), 1)

        self._run_task_over_limit()

        self.assertEqual(
            sorted(self._get_active_attachment_ids()), sorted(without_project_ids)
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    @override_settings(AUTO_DELETE_ATTACHMENTS_USERS_PER_RUN=3)
    def test_schedule_cleanup_keeps_users_left_out_when_queuing_fails(self):
        """
        Test that users whose task could not be queued are the first ones of
        the next run, instead of waiting for the next full rotation
        """
        user_ids = self._create_users_over_grace_period(count=3)

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments.delay',
            side_effect=[None, RuntimeError('broker unreachable')],
        ):
            with self.assertRaises(RuntimeError):
                schedule_auto_attachment_cleanup_for_users()

        self.assertEqual(self._run_scheduler(), user_ids[1:3])

    def _assert_lock_is_free(self):
        lock = cache.lock(self._get_lock_key(), timeout=30)
        self.assertTrue(lock.acquire(blocking=False))
        lock.release()

    def _get_active_attachment_ids(self) -> list[int]:
        return list(
            Attachment.objects.filter(user=self.owner)
            .order_by('pk')
            .values_list('pk', flat=True)
        )

    def _get_lock_key(self) -> str:
        return f'auto_delete_excess_attachments_lock_for_user_{self.owner.pk}'

    def _run_task_over_limit(self):
        """
        Run the task as if the owner was far over their storage limit, i.e.
        every attachment the task may trash is trashed
        """
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value={
                UsageType.STORAGE_BYTES: {
                    'effective_limit': 1,
                    'balance_value': -(10**12),
                    'balance_percent': 100,
                    'exceeded': True,
                },
            },
        ):
            auto_delete_excess_attachments(self.owner.pk)

    @requires_stripe
    def _create_users_over_grace_period(self, count: int, **stripe_models) -> list[int]:
        """
        Create `count` users whose storage counter is past the grace period,
        and return their IDs in the order of their counters
        """
        ExceededLimitCounter = stripe_models['exceeded_limit_counter_model']
        user_ids = []
        for idx in range(count):
            user = User.objects.create(username=f'over_limit_{idx}')
            ExceededLimitCounter.objects.create(
                user=user,
                limit_type=UsageType.STORAGE_BYTES,
                days=config.OVER_LIMIT_ATTACHMENT_RETENTION + 1,
            )
            user_ids.append(user.pk)
        return user_ids

    def _run_scheduler(self) -> list[int]:
        """
        Run `schedule_auto_attachment_cleanup_for_users` and return the IDs of
        the users it queued
        """
        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments.delay'
        ) as mock_task:
            schedule_auto_attachment_cleanup_for_users()
        return [call.args[0] for call in mock_task.call_args_list]

    def _create_submissions_with_attachments(self, count=1):
        """
        Helper method to add new submissions with attachments to the asset
        """
        for _ in range(count):
            instance_uid = uuid.uuid4()
            submission = {
                'q1': 'audio_conversion_test_clip.3gp',
                '_uuid': str(instance_uid),
                '_attachments': [
                    {
                        'download_url': f'http://testserver/{self.owner.username}/audio_conversion_test_clip.3gp',  # noqa
                        'filename': f'{self.owner.username}/audio_conversion_test_clip.3gp',  # noqa
                        'mimetype': 'video/3gpp',
                    },
                ],
                '_submitted_by': self.owner.username,
            }
            self.asset.deployment.mock_submissions([submission])
