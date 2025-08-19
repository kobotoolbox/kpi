from allauth.account.models import EmailAddress
from allauth.usersessions.models import UserSession
from django.db import connection
from django.test import Client, TransactionTestCase, modify_settings
from django.test.utils import CaptureQueriesContext
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


class TestUserSessionQueries(TransactionTestCase):

    fixtures = ['test_data']

    def test_usersession_middleware_does_not_add_extra_queries(self):
        user = User.objects.get(username='someuser')
        email_address, _ = EmailAddress.objects.get_or_create(user=user)
        email_address.primary = True
        email_address.verified = True
        email_address.save()
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }

        # login one client while UserSessionsMiddleware is active
        middleware_client = Client()
        middleware_client.post(reverse('kobo_login'), data=data)

        with modify_settings(
            MIDDLEWARE={
                'remove': 'allauth.usersessions.middleware.UserSessionsMiddleware'
            }
        ):
            # the middleware chain is set on the first request, so log in with a
            # different client while the UserSessionsMiddleware is turned off
            no_middleware_client = Client()
            no_middleware_client.post(reverse('kobo_login'), data=data)

        with CaptureQueriesContext(connection) as ctx3:
            # hit an arbitrary endpoint and record the number of queries performed
            no_middleware_client.get(reverse('api_v2:access-log-list'))
            query_count = len(ctx3.captured_queries)

        with self.assertNumQueries(query_count):
            # ensure the UserSessionsMiddleware does not perform any extra queries
            # when we hit the same endpoint
            middleware_client.get(reverse('api_v2:access-log-list'))
