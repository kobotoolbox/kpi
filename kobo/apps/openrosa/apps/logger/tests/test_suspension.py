from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.tasks import fix_stale_submissions_suspended_flag
from kobo.apps.openrosa.apps.main.models import UserProfile


class FixStaleSubmissionsSuspendedFlagTestCase(TestCase):

    def test_releases_suspended_profiles(self):
        user = User.objects.create(username='suspended')
        UserProfile.objects.create(user=user, submissions_suspended=True)

        fix_stale_submissions_suspended_flag()

        assert not UserProfile.objects.get(user=user).submissions_suspended
