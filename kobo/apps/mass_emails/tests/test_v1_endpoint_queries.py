from hub.models.v1_user_tracker import V1UserTracker
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_users_who_are_accessing_v1_endpoints
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.tests.base_test_case import BaseTestCase


class V1UserActivityQueryTests(BaseTestCase):
    """
    Tests for identifying users who are accessing v1 endpoints
    """
    fixtures = ['test_data']

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.superuser = User.objects.get(username='adminuser')
        cls.tracked_user = User.objects.create_user(
            username='tracked-user',
            email='tracked@example.com',
            password='test-pass-123',
        )
        cls.untracked_user = User.objects.create_user(
            username='untracked-user',
            email='untracked@example.com',
            password='test-pass-123',
        )

        V1UserTracker.objects.create(
            user=cls.tracked_user,
            last_accessed_path='/assets/',
        )

    def test_users_accessing_v1_endpoints(self):
        users = get_users_who_are_accessing_v1_endpoints()
        self.assertIn(self.tracked_user, users)
        self.assertNotIn(self.untracked_user, users)

    def test_trashed_users_are_excluded(self):
        # Move tracked user to trash and check they're not included
        move_to_trash(
            request_author=self.superuser,
            objects_list=[
                {
                    'pk': self.tracked_user.pk,
                    'username': self.tracked_user.username
                }
            ],
            grace_period=1,
            trash_type='user',
        )
        users = get_users_who_are_accessing_v1_endpoints()
        self.assertNotIn(self.tracked_user, users)

    def test_inactive_users_are_excluded(self):
        # Inactive tracked user
        self.tracked_user.is_active = False
        self.tracked_user.save()

        users = get_users_who_are_accessing_v1_endpoints()
        self.assertNotIn(self.tracked_user, users)
