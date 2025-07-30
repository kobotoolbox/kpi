import pytest
import uuid
from unittest.mock import patch

from constance import config
from constance.test import override_config
from django.conf import settings
from django.core.cache import cache
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.trash_bin.tasks.attachment import (
    auto_delete_excess_attachments,
    schedule_auto_attachment_cleanup_for_users
)
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


class AttachmentCleanupTestCase(TestCase, AssetSubmissionTestMixin):
    def setUp(self):
        self.owner = User.objects.create(username='owner')
        self.asset, self.xform, self.instance, self.owner_profile, self.attachment = (
            self._create_test_asset_and_submission(user=self.owner)
        )

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
            days=config.LIMIT_ATTACHMENT_REMOVAL_GRACE_PERIOD + 1,
        )

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments.delay'
        ) as mock_task:
            schedule_auto_attachment_cleanup_for_users()
            mock_task.assert_not_called()

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
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',
            return_value=mock_balances,
        ):
            auto_delete_excess_attachments(self.owner.pk)
            self.attachment.refresh_from_db()
            self.assertTrue(Attachment.objects.filter(pk=self.attachment.pk).exists())

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
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value=mock_balances,
        ):
            auto_delete_excess_attachments(self.owner.pk)
            self.attachment.refresh_from_db()
            self.assertFalse(Attachment.objects.filter(pk=self.attachment.pk).exists())

    def test_auto_delete_trashes_minimum_attachments_to_meet_limit(self):
        """
        Test only the minimum number of attachments are soft-deleted to bring
        the user within their limit, and no more.
        """
        limit_bytes = 300000

        # Add 3 more attachments
        self._create_submissions_with_attachments(count=3)

        all_attachments = list(
            Attachment.objects.filter(user=self.owner).order_by('date_created')
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
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',  # noqa
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
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',  # noqa
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
            days=config.LIMIT_ATTACHMENT_REMOVAL_GRACE_PERIOD + 1
        )

        # Non-qualifying user (within grace period)
        ExceededLimitCounter.objects.create(
            user=anotheruser,
            limit_type=UsageType.STORAGE_BYTES,
            days=config.LIMIT_ATTACHMENT_REMOVAL_GRACE_PERIOD - 1
        )

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments.delay'
        ) as mock_task:
            schedule_auto_attachment_cleanup_for_users()
            mock_task.assert_called_once_with(self.owner.pk)

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
        Test that the task does not run if a cache lock is already held
        """
        lock_key = f'auto_delete_excess_attachments_lock_for_user_{self.owner.pk}'

        # Manually acquire the lock to simulate another task running
        lock = cache.lock(lock_key, timeout=30)

        try:
            acquired = lock.acquire(blocking_timeout=0)
            self.assertTrue(acquired)

            mock_balances = {
                UsageType.STORAGE_BYTES: {
                    'effective_limit': 100000,
                    'balance_value': -50000,
                    'balance_percent': 150,
                    'exceeded': True,
                },
            }
            with patch(
                'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',  # noqa
                return_value=mock_balances,
            ):

                with patch(
                    'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments.delay'  # noqa
                ) as mock_task:
                    schedule_auto_attachment_cleanup_for_users()
                    mock_task.assert_not_called()
        finally:
            lock.release()

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
