import uuid
from datetime import timedelta

from ddt import data, ddt, unpack
from django.urls import reverse
from django.utils import timezone
from django.utils.timezone import now
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_active_users, get_inactive_users
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.object_permission import get_anonymous_user


@ddt
class UserActivityQueryTests(BaseTestCase):
    """
    Tests for identifying in/active users based on login, asset modifications,
    and submissions
    """

    @classmethod
    def setUpTestData(cls):
        cls.old_date = now() - timedelta(days=400)
        cls.recent_date = now()
        cls.null_last_login = None

    def _create_user(self, username, last_login, date_joined=None):
        """
        Helper function to create a user
        """
        date_joined = date_joined or last_login or self.recent_date
        return User.objects.create(
            username=username, last_login=last_login, date_joined=date_joined
        )

    def _create_asset(self, user, created_at=None, modified_at=None):
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
        created = created_at or timezone.now()
        modified = modified_at or timezone.now()
        asset.deploy(backend='mock', active=True)
        Asset.objects.filter(id=asset.id).update(
            date_created=created, date_modified=modified
        )
        return asset

    def _update_asset(self, asset, data, user):
        """
        Helper function to update an Asset
        """
        asset_detail_url = reverse(
            self._get_endpoint('asset-detail'), kwargs={'uid_asset': asset.uid}
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
        ('user_old_login', 'old_date', 'old_date', True, False),
        ('user_recent_login', 'recent_date', 'recent_date', False, True),
        ('user_no_login', 'recent_date', 'null_last_login', False, True),
        ('user_no_login', 'old_date', 'null_last_login', True, False),
        ('AnonymousUser', 'old_date', 'old_date', False, False),
    )
    @unpack
    def test_users_based_on_login(
        self, username, last_login, date_joined, expected_inactive, expected_active
    ):
        """
        Test users with last login older/newer than 1 year, and no login
        """
        if username == 'AnonymousUser':
            user = get_anonymous_user()
        else:
            user = self._create_user(
                username,
                getattr(self, last_login),
                date_joined=getattr(self, date_joined),
            )
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertEqual(expected_inactive, user in inactive_users)
        self.assertEqual(expected_active, user in active_users)

    def test_users_based_on_form_activity(self):
        """
        Test that a user initially marked as inactive due to old assets and
        submissions becomes active after updating an asset
        """
        user = self._create_user('active_asset', self.old_date)
        asset = self._create_asset(user, self.old_date, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)

        # Update the asset and ensure the user is no longer inactive
        self._update_asset(asset, {'name': 'Updated asset'}, user)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertFalse(user in inactive_users)
        self.assertTrue(user in active_users)

    def test_user_becomes_active_after_submission_update(self):
        """
        Test that a user initially marked as inactive due to old submissions and
        becomes active after updating a submission
        """
        user = self._create_user('active_submission', self.old_date)

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        instance = self._create_submission(user, asset, self.old_date, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)

        # Update the submission and ensure the user is no longer inactive
        submission_data = {
            'q1': 'new_answer',
            'meta/instanceID': f'uuid:{uuid.uuid4()}',
            'meta/deprecatedID': f'uuid:{instance.uuid}',
            '_submitted_by': user.username,
        }
        asset.deployment.mock_submissions([submission_data], create_uuids=False)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertFalse(user in inactive_users)
        self.assertTrue(user in active_users)

    def test_user_becomes_active_after_new_submission(self):
        """
        Test that a user initially marked as inactive due to old submissions and
        becomes active after making a new submission
        """
        user = self._create_user('active_submission', self.old_date)

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        self._create_submission(user, asset, self.old_date, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)

        # Create a new submission and ensure the user is no longer inactive
        self._create_submission(user, asset, self.recent_date, self.recent_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertFalse(user in inactive_users)
        self.assertTrue(user in active_users)

    def test_user_becomes_active_after_submitting_to_another_users_form(self):
        """
        Test that a user who submits data to another user's form
        is considered active, even if they don't own any assets
        """
        # Create asset with a different owner
        asset_owner = User.objects.create_user(username='asset_owner')
        asset = self._create_asset(asset_owner)

        # Create submitter with old login and no assets of their own
        submitter = self._create_user('submitter', self.old_date)

        # Initially the submitter should be inactive
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(submitter in inactive_users)
        self.assertFalse(submitter in active_users)

        # Create a submission to the asset owner's form
        uuid_ = uuid.uuid4()
        submission_data = {
            'q1': 'answer',
            'meta/instanceID': f'uuid:{uuid_}',
            '_submitted_by': submitter.username,
        }
        asset.deployment.mock_submissions([submission_data])

        # Now the submitter should be active
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertFalse(submitter in inactive_users)
        self.assertTrue(submitter in active_users)
    
    def test_users_in_trash_excluded_from_inactive_user_query(self):
        user = self._create_user('active_submission', self.old_date)
        superuser = User.objects.create_superuser('super')

        # Ensure the user is inactive with an old asset and submission
        asset = self._create_asset(user, self.old_date, self.old_date)
        self._create_submission(user, asset, self.old_date, self.old_date)
        inactive_users = get_inactive_users()
        active_users = get_active_users()
        self.assertTrue(user in inactive_users)
        self.assertFalse(user in active_users)
        move_to_trash(
            request_author=superuser,
            objects_list=[{'pk': user.pk, 'username': user.username}],
            grace_period=1,
            trash_type='user',
        )
        inactive_users = get_inactive_users()
        self.assertFalse(user in inactive_users)
