import uuid
from datetime import timedelta

from ddt import data, ddt, unpack
from django.urls import reverse
from django.utils.timezone import now
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_inactive_users
from kobo.apps.openrosa.apps.logger.models import Instance
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase


@ddt
class InactiveUserTest(BaseTestCase):
    """
    Tests for identifying inactive users based on login, asset modifications,
    and submissions
    """
    @classmethod
    def setUpTestData(cls):
        cls.old_date = now() - timedelta(days=400)
        cls.recent_date = now()
        cls.null_last_login = None

    def _create_user(self, username, last_login):
        """
        Helper function to create a user
        """
        return User.objects.create(
            username=username,
            last_login=last_login,
            date_joined=self.recent_date if last_login is None else last_login
        )

    def _create_asset(self, user, created_at, modified_at):
        """
        Helper function to create an Asset for a given user
        """
        content_source_asset = {
            'survey': [
                {
                    'type': 'audio',
                    'label': 'q1',
                    'required': 'false',
                    '$kuid': 'abcd',
                }
            ]
        }
        asset = Asset.objects.create(
            content=content_source_asset, owner=user, asset_type='survey'
        )
        asset.deploy(backend='mock', active=True)
        Asset.objects.filter(id=asset.id).update(
            date_created=created_at, date_modified=modified_at
        )
        return asset

    def _update_asset(self, asset, data, user):
        """
        Helper function to update an Asset
        """
        asset_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid': asset.uid}
        )
        self.client.force_login(user)
        response = self.client.patch(asset_detail_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def _create_submission(self, user, asset, created_at, modified_at):
        """
        Helper function to create a submission (Instance) for a given Asset
        """
        uuid_ = uuid.uuid4()
        submission_data = {
            'q1': 'answer',
            'meta/instanceID': f'uuid:{uuid_}',
            '_submitted_by': user.username,
        }
        asset.deployment.mock_submissions([submission_data])
        Instance.objects.filter(uuid=uuid_).update(
            date_created=created_at, date_modified=modified_at
        )
        instance = Instance.objects.get(uuid=uuid_)
        return instance

    @data(
        ('user_old_login', 'old_date', True),
        ('user_recent_login', 'recent_date', False),
        ('user_no_login', 'null_last_login', False),
    )
    @unpack
    def test_inactive_users_based_on_login(self, username, last_login, expected):
        """
        Test users with last login older/newer than 1 year, and no login
        """
        user = self._create_user(username, getattr(self, last_login))
        inactive_users = get_inactive_users()
        self.assertEqual(expected, user in inactive_users)

    def test_inactive_users_based_on_form_activity(self):
        """
        Test that a user initially marked as inactive due to old assets and
        submissions becomes active after updating an asset
        """
        user = self._create_user('active_asset', self.old_date)
        asset = self._create_asset(user, self.old_date, self.old_date)
        inactive_users = get_inactive_users()
        self.assertTrue(user in inactive_users)

        # Update the asset and ensure the user is no longer inactive
        self._update_asset(asset, {'name': 'Updated asset'}, user)
        inactive_users = get_inactive_users()
        self.assertFalse(user in inactive_users)

    def test_user_becomes_active_after_submission_update(self):
        """
        Test that a user initially marked as inactive due to old submissions and
        becomes active after updating a submission
        """
        user = self._create_user('active_submission', self.old_date)

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        instance = self._create_submission(
            user, asset, self.old_date, self.old_date
        )
        inactive_users = get_inactive_users()
        self.assertTrue(user in inactive_users)

        # Update the submission and ensure the user is no longer inactive
        submission_data = {
            'q1': 'new_answer',
            'meta/instanceID': f'uuid:{uuid.uuid4()}',
            'meta/deprecatedID': f'uuid:{instance.uuid}',
            '_submitted_by': user.username,
        }
        asset.deployment.mock_submissions([submission_data], create_uuids=False)
        inactive_users = get_inactive_users()
        self.assertFalse(user in inactive_users)

    def test_user_becomes_active_after_new_submission(self):
        """
        Test that a user initially marked as inactive due to old submissions and
        becomes active after making a new submission
        """
        user = self._create_user('active_submission', self.old_date)

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        self._create_submission(
            user, asset, self.old_date, self.old_date
        )
        inactive_users = get_inactive_users()
        self.assertTrue(user in inactive_users)

        # Create a new submission and ensure the user is no longer inactive
        self._create_submission(user, asset, self.recent_date, self.recent_date)
        inactive_users = get_inactive_users()
        self.assertFalse(user in inactive_users)
