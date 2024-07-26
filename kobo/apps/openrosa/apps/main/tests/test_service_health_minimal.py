from django.test import TestCase
from django.urls import reverse


class ServiceHealthMinimalTestCase(TestCase):
    url = reverse('legacy-service-health-minimal')

    def test_service_health_minimal(self):
        with self.assertNumQueries(0):
            res = self.client.get(self.url)

        # Check that the response content contains "ok"
        self.assertContains(res, 'ok')
