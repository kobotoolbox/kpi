from django.http import HttpResponse, JsonResponse
from django.test import RequestFactory, SimpleTestCase
from django.urls import reverse
from rest_framework import status

from hub.middleware import NeverCacheJSONMiddleware
from kpi.tests.base_test_case import BaseTestCase

NEVER_CACHE_DIRECTIVES = {
    'max-age=0',
    'no-cache',
    'no-store',
    'must-revalidate',
    'private',
}


def _cache_control_directives(response):
    return {d.strip() for d in response['Cache-Control'].split(',')}


class NeverCacheJSONMiddlewareTestCase(SimpleTestCase):

    def _process(self, response):
        middleware = NeverCacheJSONMiddleware(lambda request: response)
        return middleware(RequestFactory().get('/'))

    def test_json_response_gets_never_cache_headers(self):
        response = self._process(JsonResponse({}))
        assert NEVER_CACHE_DIRECTIVES <= _cache_control_directives(response)
        assert response.has_header('Expires')

    def test_json_response_with_charset_gets_never_cache_headers(self):
        response = self._process(
            HttpResponse('{}', content_type='application/json; charset=utf-8')
        )
        assert NEVER_CACHE_DIRECTIVES <= _cache_control_directives(response)
        assert response.has_header('Expires')

    def test_existing_cache_control_is_kept(self):
        json_response = JsonResponse({})
        json_response['Cache-Control'] = 'max-age=900'
        response = self._process(json_response)
        assert response['Cache-Control'] == 'max-age=900'

    def test_non_json_responses_are_untouched(self):
        for content_type in ('text/html', 'image/png'):
            response = self._process(HttpResponse('x', content_type=content_type))
            assert not response.has_header('Cache-Control')


class NeverCacheJSONMiddlewareIntegrationTestCase(BaseTestCase):
    fixtures = ['test_data']

    def test_asset_list_is_not_cached(self):
        self.client.login(username='someuser', password='someuser')
        response = self.client.get(reverse(self._get_endpoint('asset-list')))
        assert response.status_code == status.HTTP_200_OK
        assert 'no-store' in _cache_control_directives(response)

    def test_anonymous_error_response_is_not_cached(self):
        response = self.client.get(reverse('currentuser-detail'))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'no-store' in _cache_control_directives(response)
