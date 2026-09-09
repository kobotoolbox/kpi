from unittest.mock import patch

from django.conf import settings
from django.core.management import call_command
from django.test import TestCase
from django_redis import get_redis_connection

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.constants import (
    SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX,
)
from kobo.apps.openrosa.apps.logger.management.commands import (
    update_attachment_storage_bytes,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.models import Asset
from kpi.tests.mixins.create_asset_and_submission_mixin import AssetSubmissionTestMixin


class UpdateAttachmentStorageBytesTestCase(TestCase, AssetSubmissionTestMixin):

    def setUp(self):
        self.user = User.objects.create(username='storageuser')
        self._create_test_asset_and_submission(user=self.user)
        self.redis_client = get_redis_connection()
        self.holders_key = (
            f'{SUBMISSIONS_SUSPENDED_HOLDERS_KEY_PREFIX}{self.user.username}'
        )

    def tearDown(self):
        settings.MONGO_DB.instances.delete_many({})
        self.redis_client.delete(self.holders_key, f'{self.holders_key}:lock')

    def test_suspends_owner_while_counting_then_releases(self):
        captured = {}
        original = update_attachment_storage_bytes.Command._update_user_profile

        def spy(command, user):
            captured['suspended'] = UserProfile.objects.get(
                user=user
            ).submissions_suspended
            return original(command, user)

        with patch.object(
            update_attachment_storage_bytes.Command, '_update_user_profile', spy
        ):
            call_command(
                'update_attachment_storage_bytes',
                username=self.user.username,
                verbosity=0,
            )

        assert captured['suspended'] is True
        profile = UserProfile.objects.get(user=self.user)
        assert profile.submissions_suspended is False
        assert profile.metadata['attachments_counting_status'] == 'complete'
        xform = Asset.objects.get(owner=self.user).deployment.xform
        assert profile.attachment_storage_bytes == xform.attachment_storage_bytes
        assert not self.redis_client.exists(self.holders_key)
