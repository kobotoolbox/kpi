from django.test import TestCase
from django.urls import reverse


class ServiceHealthMinimalTestCase(TestCase):
    """
    Test for endpoint which makes no connections to databases or other external
    services and is helpful for HTTP health checks.
    """

    url = reverse('service-health-minimal')

    def test_service_health_minimal(self):
        with self.assertNumQueries(0):
            res = self.client.get(self.url)
        self.assertContains(res, 'ok')
