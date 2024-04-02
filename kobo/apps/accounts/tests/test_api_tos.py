from django.conf import settings
from django.utils.timezone import now
from django.urls import reverse
from rest_framework import status
from model_bakery import baker

from kpi.tests.base_test_case import BaseTestCase


class TOSTestCase(BaseTestCase):
    def setUp(self) -> None:
        self.url = reverse(self._get_endpoint('tos'))
        self.user = baker.make(
            settings.AUTH_USER_MODEL, username='spongebob', email='me@sponge.bob'
        )
        self.client.force_login(self.user)

    def test_post(self):
        # Prepare and send the request with empty payload
        time = now().strftime('%Y-%m-%dT%H:%M:%SZ')
        response = self.client.post(self.url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Check the db to make sure the expected changes were made
        self.user.refresh_from_db()
        assert (
            self.user.extra_details.private_data['last_tos_accept_time']
            is not None
        )
        assert (
            self.user.extra_details.private_data['last_tos_accept_time'] >= time
        )
