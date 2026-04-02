from datetime import timedelta

from django.utils import timezone

from hub.models.v1_user_tracker import V1UserTracker
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.mass_emails.user_queries import get_users_who_are_accessing_v1_endpoints
from kobo.apps.trash_bin.utils import move_to_trash
from kpi.tests.base_test_case import BaseTestCase


class V1UserActivityQueryTests(BaseTestCase):
    """
    Tests for identifying users who are accessing v1 endpoints
    """

    def setUp(self):
        super().setUp()
        self.tracked_user = User.objects.create_user(
            username='tracked-user',
            email='tracked@example.com',
            password='test-pass-123',
        )
        self.untracked_user = User.objects.create_user(
            username='untracked-user',
            email='untracked@example.com',
            password='test-pass-123',
        )

        V1UserTracker.objects.create(
            user=self.tracked_user,
            last_accessed_path='/assets/',
        )

    def test_users_accessing_v1_endpoints(self):
        users = get_users_who_are_accessing_v1_endpoints()
        self.assertIn(self.tracked_user, users)
        self.assertNotIn(self.untracked_user, users)

    def test_trashed_users_are_excluded(self):
        superuser = User.objects.create_superuser('super')

        # Move tracked user to trash and check they're not included
        move_to_trash(
            request_author=superuser,
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

    def test_users_with_old_v1_access_are_excluded(self):
        # Set last accessed to over 90 days ago
        old_date = timezone.now() - timedelta(days=91)
        V1UserTracker.objects.filter(user=self.tracked_user).update(
            last_accessed=old_date,
        )

        users = get_users_who_are_accessing_v1_endpoints(days=90)
        self.assertNotIn(self.tracked_user, users)
