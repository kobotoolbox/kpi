import responses
from django.conf import settings
from django.test import TestCase
from django.urls import reverse


class ServiceHealthTestCase(TestCase):
    url = reverse('service-health')

    @responses.activate
    def test_service_health(self):
        responses.add(responses.GET, settings.ENKETO_INTERNAL_URL, status=200)
        res = self.client.get(self.url)
        self.assertContains(res, 'OK')

    @responses.activate
    def test_service_health_failure(self):
        responses.add(responses.GET, settings.ENKETO_INTERNAL_URL, status=500)
        res = self.client.get(self.url)
        self.assertContains(res, 'HTTPError', status_code=500)
