from datetime import datetime

from constance.test import override_config
from django.conf import settings
from django.test import RequestFactory
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.gravatar_url import gravatar_url


class CurrentUserTestCase(BaseTestCase):
    def setUp(self) -> None:
        self.url = reverse(self._get_endpoint('currentuser-detail'))
        self.user = User.objects.create_user(
            username='delete_me',
            password='delete_me',
            is_active=True,
        )

    def test_user_deactivation(self):
        # Check user account is as expected
        assert self.user.is_active is True
        assert self.user.extra_details.date_removal_requested is None

        # Prepare and send the request
        self.client.login(username='delete_me', password='delete_me')
        payload = {
            'confirm': self.user.extra_details.uid,
        }
        response = self.client.delete(self.url, data=payload, format='json')
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Check the db to make sure the expected changes were made
        self.user.refresh_from_db()
        assert self.user.is_active is False
        assert self.user.extra_details.date_removal_requested is not None
        assert type(self.user.extra_details.date_removal_requested) is datetime

    def test_cannot_delete_when_confirm_different_from_uid(self):
        # Check user account is as expected
        assert self.user.is_active is True
        assert self.user.extra_details.date_removal_requested is None

        # Prepare and send the request
        self.client.login(username='delete_me', password='delete_me')
        payload = {
            'confirm': True,
        }
        response = self.client.delete(self.url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Check the db to make sure that no changes were made
        self.user.refresh_from_db()
        assert self.user.is_active is True
        assert self.user.extra_details.date_removal_requested is None

    def test_cannot_delete_without_confirm(self):
        # Check user account is as expected
        assert self.user.is_active is True
        assert self.user.extra_details.date_removal_requested is None

        # Prepare and send the request
        self.client.login(username='delete_me', password='delete_me')
        payload = {
            'not_confirm':  self.user.extra_details.uid,
        }
        response = self.client.delete(self.url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Check the db to make sure that no changes were made
        self.user.refresh_from_db()
        assert self.user.is_active is True
        assert self.user.extra_details.date_removal_requested is None

    def test_cannot_delete_without_payload(self):
        # Check user account is as expected
        assert self.user.is_active is True
        assert self.user.extra_details.date_removal_requested is None

        # Prepare and send the request
        self.client.login(username='delete_me', password='delete_me')
        response = self.client.delete(self.url, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Check the db to make sure that no changes were made
        self.user.refresh_from_db()
        assert self.user.is_active is True
        assert self.user.extra_details.date_removal_requested is None

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=True,
        MINIMUM_PASSWORD_LENGTH=10,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=True,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=True,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_password_is_validated_with_django(self):
        """
        Only use 3 of possible validators to test that endpoint does use Django
        password validation.
        """
        password = 'delete_me'
        self.client.login(username='delete_me', password=password)
        payload = {
            'current_password': password,
            'new_password': password,
        }

        response = self.client.patch(self.url, data=payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        errors = {
            'The password is too similar to the username.',
            'This password is too short. It must contain at least 10 characters.',
            'You cannot reuse your last password.'
        }
        assert errors == {str(e) for e in response.data['new_password']}

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_validated_password_becomes_true_on_password_change(self):

        password = 'delete_me'
        self.user.extra_details.validated_password = False
        self.user.extra_details.save(update_fields=['validated_password'])
        assert self.user.extra_details.password_date_changed is None
        now = timezone.now()
        self.client.login(username='delete_me', password=password)
        payload = {
            'current_password': password,
            'new_password': password,
        }
        response = self.client.patch(self.url, data=payload, format='json')
        assert response.status_code == status.HTTP_200_OK

        self.user.refresh_from_db()
        assert self.user.extra_details.validated_password
        assert self.user.extra_details.password_date_changed is not None
        assert self.user.extra_details.password_date_changed >= now

    def test_cannot_update_organization_fields_with_mmo(self):
        self.user.organization.mmo_override = True
        self.user.organization.save()

    def test_cannot_change_statuses(self):
        self.client.force_authenticate(self.user)
        for flag in ['is_superuser', 'is_staff']:
            payload = {flag: True}
            assert getattr(self.user, flag, False) is False
            response = self.client.patch(self.url, data=payload, format='json')
            # Field is ignored because it's not in Serializer fields
            assert response.status_code == status.HTTP_200_OK
            self.user.refresh_from_db()
            # Validate the flag kept the original value
            assert getattr(self.user, flag, False) is False

    def test_expected_result(self):
        request = RequestFactory().get('/')
        self.client.force_authenticate(self.user)
        time = timezone.now()
        with freeze_time(time):
            response = self.client.get(self.url)
        assert response.data == {
            'username': self.user.username,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'email': self.user.email,
            'server_time': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'date_joined': self.user.date_joined.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'projects_url': '/'.join((settings.KOBOCAT_URL, self.user.username)),
            'gravatar': gravatar_url(self.user.email),
            'extra_details': {
                'organization': '',
                'name': '',
                'require_auth': True,
            },
            'git_rev': False,
            'social_accounts': [],
            'validated_password': True,
            'accepted_tos': False,
            'organization': {
                'url': reverse(
                    'api_v2:organizations-detail',
                    kwargs={'id': self.user.organization.id},
                    request=request,
                ),
                'name': self.user.organization.name,
                'uid': self.user.organization.id,
            },
            'last_login': None,
            'extra_details__uid': self.user.extra_details.uid,
        }

    def test_cannot_update_uid(self):
        self.client.force_authenticate(self.user)
        uid = self.user.extra_details.uid
        response = self.client.patch(
            self.url, data={'extra_details__uid': 'u12345'}, format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        self.user.refresh_from_db()
        assert self.user.extra_details.uid == uid
