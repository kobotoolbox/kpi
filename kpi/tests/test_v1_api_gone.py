from ddt import data, ddt
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APIClient

from kobo.urls import REMOVED_V1_API_PREFIXES


@ddt
class V1APIGoneViewTest(SimpleTestCase):
    """
    Tests for V1APIGoneView: all removed V1 API routes must return 410 Gone
    for every HTTP method, with proper content negotiation.
    """

    def setUp(self):
        self.client = APIClient()

    @data('get', 'post', 'put', 'patch', 'delete', 'options')
    def test_returns_410_for_any_method(self, method):
        response = getattr(self.client, method)('/api/v1/')
        assert response.status_code == status.HTTP_410_GONE

    def test_response_detail_contains_migration_url(self):
        response = self.client.get('/api/v1/', format='json')
        assert 'detail' in response.data
        assert 'migrating_api.html' in response.data['detail']

    def test_json_content_negotiation(self):
        response = self.client.get('/api/v1/', HTTP_ACCEPT='application/json')
        assert response['Content-Type'].startswith('application/json')

    def test_xml_content_negotiation(self):
        response = self.client.get('/api/v1/', HTTP_ACCEPT='application/xml')
        assert response['Content-Type'].startswith('application/xml')

    def test_html_content_negotiation(self):
        response = self.client.get('/api/v1/', HTTP_ACCEPT='text/html')
        assert response['Content-Type'].startswith('text/html')

    @data(*REMOVED_V1_API_PREFIXES)
    def test_all_removed_prefixes_return_410(self, prefix):
        response = self.client.get(f'/{prefix}/')
        assert response.status_code == status.HTTP_410_GONE
