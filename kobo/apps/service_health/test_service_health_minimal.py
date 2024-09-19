from django.test import TestCase, override_settings


class ServiceHealthMinimalTestCase(TestCase):
    url = '/service_health/minimal/'  # Path checked in middleware, can't use reverse

    @override_settings(ALLOWED_HOSTS=['nope'])
    def test_service_health_minimal(self):
        """
        Test for endpoint which makes no connections to databases or other external
        services, ignores ALLOWED_HOSTS, and is helpful for HTTP health checks.
        """
        with self.assertNumQueries(0):
            res = self.client.get(self.url)
        self.assertContains(res, 'ok')
