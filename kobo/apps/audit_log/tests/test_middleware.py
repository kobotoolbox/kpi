from django.test import TestCase


class ProjectHistoryLogMiddlewareTestCase(TestCase):

    def test_request_without_resolved_route_is_ignored(self):
        # CorsMiddleware answers a preflight from process_request, before URL
        # resolution, so `request.resolver_match` is still None on the way out
        response = self.client.options(
            '/api/v2/assets/',
            HTTP_ORIGIN='https://example.org',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
        )

        assert response.status_code == 200
        assert response.wsgi_request.resolver_match is None
