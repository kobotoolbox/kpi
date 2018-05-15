import constance
from rest_framework.test import APITestCase
from django.core.urlresolvers import reverse
from rest_framework import status

class EnvironmentTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.url = reverse('environment')
        self.expected_dict = {
            'terms_of_service_url': constance.config.TERMS_OF_SERVICE_URL,
            'privacy_policy_url': constance.config.PRIVACY_POLICY_URL,
            'source_code_url': constance.config.SOURCE_CODE_URL,
            'support_url': constance.config.SUPPORT_URL,
            'support_email': constance.config.SUPPORT_EMAIL,
        }

    def test_anonymous_succeeds(self):
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertDictEqual(response.data, self.expected_dict)

    def test_authenticated_succeeds(self):
        self.client.login(username='admin', password='pass')
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertDictEqual(response.data, self.expected_dict)
