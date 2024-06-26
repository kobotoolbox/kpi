# coding: utf-8
from django_digest.test import DigestAuth, BasicAuth
from rest_framework import authentication

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import \
    TestAbstractViewSet
from kobo.apps.openrosa.apps.api.viewsets.connect_viewset import ConnectViewSet
from kpi.authentication import DigestAuthentication


class TestConnectViewSet(TestAbstractViewSet):
    def setUp(self):
        super().setUp()
        self.view = ConnectViewSet.as_view({
            "get": "list",
        })

        # PostgreSQL behaves differently than SQLite. After each test, table is
        # truncated but PostgreSQL does not reset its sequences but SQLite does.
        # `self.user_profile_data()` does contain the real value of user's id.
        # let's use it.
        user_profile_data = self.user_profile_data()

        self.data = {
            'id': user_profile_data['id'],
            'username': user_profile_data['username'],
            'name': user_profile_data['name'],
            'email': user_profile_data['email'],
            'city': user_profile_data['city'],
            'country': user_profile_data['country'],
            'organization': user_profile_data['organization'],
            'website': user_profile_data['website'],
            'twitter': user_profile_data['twitter'],
            'gravatar': user_profile_data['gravatar'],
            'require_auth': True,
            'api_token': self.user.auth_token.key,
            'temp_token': self.client.session.session_key,
        }

    def test_get_profile(self):
        request = self.factory.get('/', **self.extra)
        request.session = self.client.session

        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, self.data)

    def test_user_list_with_digest(self):
        view = ConnectViewSet.as_view(
            {'get': 'list'},
            authentication_classes=(DigestAuthentication,))
        request = self.factory.head('/')

        auth = DigestAuth('bob', 'bob')
        response = view(request)
        self.assertTrue(response.has_header('WWW-Authenticate'))
        self.assertTrue(
            response['WWW-Authenticate'].startswith('Digest realm="DJANGO", qop="auth", nonce='))
        request = self.factory.get('/')
        request.META.update(auth(request.META, response))
        request.session = self.client.session

        response = view(request)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['detail'],
                         "Invalid username/password")
        auth = DigestAuth('bob', 'bobbob')
        request.META.update(auth(request.META, response))
        request.session = self.client.session

        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, self.data)

    def test_user_list_with_basic_and_digest(self):
        view = ConnectViewSet.as_view(
            {'get': 'list'},
            authentication_classes=(
                DigestAuthentication,
                authentication.BasicAuthentication
            ))
        request = self.factory.get('/')
        auth = BasicAuth('bob', 'bob')
        request.META.update(auth(request.META))
        request.session = self.client.session

        response = view(request)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['detail'],
                         "Invalid username/password.")
        auth = BasicAuth('bob', 'bobbob')

        # redo the request
        request = self.factory.get('/')
        request.META.update(auth(request.META))
        request.session = self.client.session

        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, self.data)
