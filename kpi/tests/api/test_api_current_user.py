from datetime import datetime

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.tests.base_test_case import BaseTestCase


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
