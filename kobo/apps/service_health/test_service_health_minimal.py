from django.test import TestCase
from django.urls import reverse


class ServiceHealthMinimalTestCase(TestCase):
    url = reverse('service-health-minimal')

    def test_service_health_minimal(self):
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)

        # Check that the response content is "ok"
        expected_content = 'ok'
        actual_content = res.content.decode('utf-8')
        self.assertEqual(actual_content, expected_content)

        # Ensure that no database queries were executed
        self.assertNumQueries(0)
