from allauth.usersessions.models import UserSession
from django.urls import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase


class TestLogoutAll(BaseTestCase):

    fixtures = ['test_data']

    def test_logout_all_sessions(self):
        # create 2 user sessions
        user = User.objects.get(username='someuser')
        UserSession.objects.create(user=user, session_key='12345', ip='1.2.3.4')
        UserSession.objects.create(user=user, session_key='56789', ip='5.6.7.8')
        count = UserSession.objects.filter(user=user).count()
        self.assertEqual(count, 2)
        self.client.force_login(user)
        url = self._get_endpoint('logout_all')
        self.client.post(reverse(url))

        # ensure both sessions have been deleted
        count = UserSession.objects.filter(user=user).count()
        self.assertEqual(count, 0)

    def test_logout_all_sessions_does_not_affect_other_users(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        # create sessions for user1
        UserSession.objects.create(user=user1, session_key='12345', ip='1.2.3.4')
        UserSession.objects.create(user=user1, session_key='56789', ip='5.6.7.8')
        count = UserSession.objects.count()
        self.assertEqual(count, 2)

        # login user2
        self.client.force_login(user2)
        url = self._get_endpoint('logout_all')
        self.client.post(reverse(url))

        # ensure no sessions have been deleted
        count = UserSession.objects.filter().count()
        self.assertEqual(count, 2)
