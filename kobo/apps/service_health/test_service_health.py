import responses
from django.test import TestCase
from django.urls import reverse


class ServiceHealthTestCase(TestCase):
    url = reverse('service-health')

    @responses.activate
    def test_service_health(self):
        responses.add(responses.GET, 'http://enketo.mock', status=200)
        responses.add(
            responses.GET, 'http://kobocat:8001/service_health/', status=200
        )
        res = self.client.get(self.url)
        self.assertContains(res, "OK")

    @responses.activate
    def test_service_health_failure(self):
        responses.add(responses.GET, 'http://enketo.mock', status=500)
        responses.add(
            responses.GET, 'http://kobocat:8001/service_health/', status=200
        )
        res = self.client.get(self.url)
        self.assertContains(res, "HTTPError", status_code=500)
