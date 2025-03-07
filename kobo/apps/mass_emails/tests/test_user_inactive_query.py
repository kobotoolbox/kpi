import uuid
from datetime import timedelta

from ddt import data, ddt, unpack
from django.test import TestCase
from django.utils.timezone import now

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_inactive_users
from kobo.apps.openrosa.apps.logger.models import Instance
from kpi.models import Asset


@ddt
class InactiveUserTest(TestCase):
    """
    Tests for identifying inactive users based on login, asset modifications,
    and submissions
    """
    @classmethod
    def setUpTestData(cls):
        cls.old_date = now() - timedelta(days=400)
        cls.recent_date = now()

    def _create_user(self, username, last_login):
        """
        Helper function to create a user
        """
        return User.objects.create(username=username, last_login=last_login)

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
                },
                {
                    'type': 'file',
                    'label': 'q2',
                    'required': 'false',
                    '$kuid': 'efgh',
                },
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

    def _create_submission(self, user, asset, created_at, modified_at):
        """
        Helper function to create a submission (Instance) for a given Asset
        """
        uuid_ = uuid.uuid4()
        submission_data = {
            'q1': 'answer',
            'q2': 'answer',
            'meta/instanceID': f'uuid:{uuid_}',
            '_uuid': str(uuid_),
            '_submitted_by': user.username,
        }
        asset.deployment.mock_submissions([submission_data])
        Instance.objects.filter(uuid=uuid_).update(
            date_created=created_at, date_modified=modified_at
        )

    @data(
        ('user_old_login', 'old_date', True),
        ('user_recent_login', 'recent_date', False)
    )
    @unpack
    def test_inactive_users_based_on_login(self, username, last_login, expected):
        """
        Test users with last login older/newer than 1 year
        """
        user = self._create_user(username, getattr(self, last_login))
        inactive_users = get_inactive_users()
        self.assertEqual(expected, user in inactive_users)

    @data(
        ('old_date', True),
        ('recent_date', False)
    )
    @unpack
    def test_inactive_users_based_on_form_activity(self, date, expected):
        """
        Test users with inactive/active Asset modification dates
        """
        user = self._create_user('active_asset', self.old_date)
        self._create_asset(user, getattr(self, date), getattr(self, date))

        inactive_users = get_inactive_users()
        self.assertEqual(expected, user in inactive_users)

    def test_inactive_users_after_form_edit_without_redeployment(self):
        user = self._create_user('active_asset', self.old_date)
        asset = self._create_asset(user, self.old_date, self.old_date)

        # Ensure user is in the inactive list
        inactive_users = get_inactive_users()
        self.assertEqual(True, user in inactive_users)

        # Edit the asset without redeploying
        Asset.objects.filter(id=asset.id).update(
            name='updated_asset', date_modified=self.recent_date
        )
        asset.refresh_from_db()

        # Ensure the user is no longer in the inactive list
        inactive_users = get_inactive_users()
        self.assertEqual(False, user in inactive_users)

    @data(
        ('old_date', True),
        ('recent_date', False)
    )
    @unpack
    def test_inactive_users_based_on_submission_activity(self, date, expected):
        """
        Test users with inactive/active submission dates
        """
        user = self._create_user('active_submission', self.old_date)
        asset = self._create_asset(user, self.old_date, self.old_date)
        self._create_submission(
            user, asset, getattr(self, date), getattr(self, date)
        )

        inactive_users = get_inactive_users()
        self.assertEqual(expected, user in inactive_users)
