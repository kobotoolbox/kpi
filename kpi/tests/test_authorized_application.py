from datetime import datetime
from zoneinfo import ZoneInfo

from ddt import data, ddt, unpack
from django.urls import reverse
from freezegun import freeze_time
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.authorized_application import AuthorizedApplication
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from .base_test_case import BaseTestCase


@ddt
class AuthorizedApplicationUserTestCase(BaseTestCase):

    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.app = AuthorizedApplication.objects.create(name='TestApp')
        self.token = self.app.key
        self.url = reverse(self._get_endpoint('authorized_applications-list'))
        self.payload = {
            'username': 'johndoe',
            'password': 'testpass123',
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'john.doe@example.org',
        }
        self.headers = {'HTTP_AUTHORIZATION': f'Token {self.token}'}

    def test_create_user_with_valid_token(self):
        frozen_datetime_now = datetime(
            year=2025,
            month=7,
            day=29,
            tzinfo=ZoneInfo('UTC'),
        )
        with freeze_time(frozen_datetime_now):
            response = self.client.post(self.url, data=self.payload, **self.headers)
        assert response.status_code == status.HTTP_201_CREATED
        assert User.objects.filter(username='johndoe').exists()
        expected = {
            'username': 'johndoe',
            'first_name': 'John',
            'last_name': 'Doe',
            'email': 'john.doe@example.org',
        }
        assert response.data == expected

    def test_create_user_without_token_is_forbidden(self):
        response = self.client.post(self.url, data=self.payload)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert not User.objects.filter(username='johndoe').exists()

    def test_get_method_not_allowed(self):
        response = self.client.get(self.url, **self.headers)
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_authentication_class_is_application_token_only(self):
        self.client.login(username='someuser', password='someuser')
        response = self.client.post(self.url, data=self.payload)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @data(
        ('johndoe', 'testpass123', status.HTTP_200_OK, None),  # trivial case
        (
            'johndoe',
            'testpass123',
            status.HTTP_401_UNAUTHORIZED,
            {'HTTP_AUTHORIZATION': 'Token BadToken'},
        ),  # wrong key
        ('janedoe', 'testpass123', status.HTTP_403_FORBIDDEN, None),  # unknown user
        ('johndoe', 'wrongpassword', status.HTTP_403_FORBIDDEN, None),  # bad password
    )
    @unpack
    def test_authenticate_user(self, username, password, status_code, new_headers):
        self.test_create_user_with_valid_token()
        payload = {
            'username': username,
            'password': password,
        }
        url = reverse('authorized-application-authenticate-user')

        headers = self.headers.copy()
        if new_headers:
            headers.update(new_headers)

        response = self.client.post(url, data=payload, **headers)
        assert response.status_code == status_code
        if status_code == status.HTTP_200_OK:
            user = User.objects.get(username=username)
            expected = {
                'token': user.auth_token.key,
                'username': 'johndoe',
                'first_name': 'John',
                'last_name': 'Doe',
                'email': 'john.doe@example.org',
                'is_staff': False,
                'is_active': True,
                'is_superuser': False,
                'last_login': None,
                'date_joined': datetime(2025, 7, 29, tzinfo=ZoneInfo('UTC')),
            }
            assert response.data == expected
