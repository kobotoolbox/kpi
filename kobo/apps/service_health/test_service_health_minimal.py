import responses
from django.conf import settings
from django.test import TestCase
from django.urls import reverse


class ServiceHealthMinimalTestCase(TestCase):
    url = reverse('service-health-minimal')

    @responses.activate
    def test_service_health_minimalhealth(self):
        responses.add(responses.GET, settings.ENKETO_INTERNAL_URL, status=200)
        responses.add(
            responses.GET,
            settings.KOBOCAT_INTERNAL_URL + 'service_health/minimal/',
            status=200,
        )
        res = self.client.get(self.url)
        self.assertContains(res, "ok")
        self.assertNumQueries(0)
