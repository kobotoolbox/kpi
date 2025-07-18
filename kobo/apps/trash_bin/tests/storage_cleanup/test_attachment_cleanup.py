import uuid
from unittest.mock import patch

from constance import config
from constance.test import override_config
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.models import ExceededLimitCounter
from kobo.apps.trash_bin.tasks.attachment import auto_delete_excess_attachments, \
    schedule_auto_attachment_cleanup_for_users
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


class AttachmentCleanupTestCase(TestCase, AssetSubmissionTestMixin):
    def setUp(self):
        self.owner = User.objects.create(username='owner')
        self.asset, self.xform, self.instance, self.owner_profile, self.attachment = (
            self._create_test_asset_and_submission(user=self.owner)
        )

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

    def test_auto_delete_stops_when_user_is_within_storage_limit(self):
        """
        Test that attachments are soft deleted only until the user's exceeded
        storage usage is resolved, and further deletions are not performed
        """
        mock_balances = {
            UsageType.STORAGE_BYTES: {
                'effective_limit': 100000,
                'balance_value': -82255,
                'balance_percent': 182,
                'exceeded': True
            },
        }
        with patch(
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value=mock_balances,
        ):
            auto_delete_excess_attachments(self.owner.pk)
            self.assertFalse(Attachment.objects.filter(pk=self.attachment.pk).exists())
            self.assertEqual(Attachment.objects.all().count(), 0)

        updated_balances = {
            UsageType.ASR_SECONDS: None,
            UsageType.MT_CHARACTERS: None,
            UsageType.STORAGE_BYTES: {
                'effective_limit': 100000,
                'balance_value': 100000,
                'balance_percent': 100,
                'exceeded': False
            },
            UsageType.SUBMISSION: None
        }

        # Add another attachment after user is now within limit
        instance_uid = uuid.uuid4()
        submission = {
            'q1': 'audio_conversion_test_image.jpg',
            '_uuid': str(instance_uid),
            '_attachments': [
                {
                    'download_url': f'http://testserver/{self.owner.username}/audio_conversion_test_image.jpg',  # noqa
                    'filename': f'{self.owner.username}/audio_conversion_test_image.jpg',  # noqa
                    'mimetype': 'image/jpeg',
                },
            ],
            '_submitted_by': self.owner.username,
        }
        self.asset.deployment.mock_submissions([submission])
        self.assertEqual(Attachment.objects.all().count(), 1)

        with patch(
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value=updated_balances
        ):
            auto_delete_excess_attachments(self.owner.pk)

        # The new attachment should *not* be deleted since user is no longer over limit
        self.assertEqual(Attachment.objects.all().count(), 1)

    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_schedule_cleanup_task_only_for_users_exceeding_grace_period(self):
        """
        Test that only users over their limit for more than the grace period are
        scheduled for attachment cleanup
        """
        ExceededLimitCounter.objects.create(
            user=self.owner,
            limit_type=UsageType.STORAGE_BYTES,
            days=config.STORAGE_OVERAGE_ATTACHMENT_DELETION_GRACE_PERIOD + 1
        )

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments'
        ) as mock_task:
            schedule_auto_attachment_cleanup_for_users()
            mock_task.assert_called_once_with(self.owner.pk)

    @override_config(AUTO_DELETE_ATTACHMENTS=True)
    def test_schedule_cleanup_task_skips_users_below_grace_period(self):
        """
        Test that users who are over their limit but within the grace period
        are not scheduled for attachment cleanup
        """
        ExceededLimitCounter.objects.create(
            user=self.owner,
            limit_type=UsageType.STORAGE_BYTES,
            days=config.STORAGE_OVERAGE_ATTACHMENT_DELETION_GRACE_PERIOD - 1
        )

        with patch(
            'kobo.apps.trash_bin.tasks.attachment.auto_delete_excess_attachments'
        ) as mock_task:
            schedule_auto_attachment_cleanup_for_users()
            mock_task.assert_not_called()

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
