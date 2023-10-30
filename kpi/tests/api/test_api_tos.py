from django.contrib.auth.models import User
from django.utils.timezone import now
from django.urls import reverse
from rest_framework import status

from kpi.tests.base_test_case import BaseTestCase


class TOSTestCase(BaseTestCase):
    def setUp(self) -> None:
        self.url = reverse(self._get_endpoint('tos'))
        self.user = User.objects.create_user(
            username='someuser',
            password='someuser',
            is_active=True,
        )
        self.client.login(username='someuser', password='someuser')

    def test_post(self):
        # Check user account is as expected
        assert self.user.is_active is True

        data = {}
        # Prepare and send the request
        time = now().strftime('%Y-%m-%dT%H:%M:%SZ')
        response = self.client.post(self.url, data=data)
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Check the db to make sure the expected changes were made
        self.user.refresh_from_db()
        assert self.user.extra_details.private_data['current_time'] is not None
        assert self.user.extra_details.private_data['current_time'] >= time
