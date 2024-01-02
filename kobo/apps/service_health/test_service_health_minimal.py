from django.test import TestCase
from django.urls import reverse


class ServiceHealthMinimalTestCase(TestCase):
    url = reverse('service-health-minimal')

    def test_service_health_minimal(self):
        """
        Test for endpoint which makes no connections to databases or other external
        services and is helpful for HTTP health checks.
        """
        with self.assertNumQueries(0):
            res = self.client.get(self.url)
        self.assertContains(res, 'ok')
