from django.http import HttpResponse, JsonResponse
from django.test import RequestFactory, TestCase, override_settings

from kobo.apps.openapi_validator.middleware import OpenAPIValidationMiddleware


@override_settings(OPENAPI_VALIDATION_STRICT=False)
class OpenAPIValidationMiddlewareTestCase(TestCase):
    """
    Non-strict mode must never interrupt the request cycle: mismatches are
    logged, not raised. Strict mode (enabled in the test settings) is what
    turns them into test failures.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = OpenAPIValidationMiddleware(lambda request: HttpResponse())

    def test_undecodable_request_body_does_not_raise(self):
        request = self.factory.post(
            '/api/v2/assets/',
            data=b'\xff\xfe invalid utf-8',
            content_type='application/json',
        )

        assert self.middleware.process_request(request) is None

    def test_undecodable_response_body_does_not_raise(self):
        request = self.factory.get('/api/v2/assets/')
        response = HttpResponse(
            b'\xff\xfe invalid utf-8', content_type='application/json'
        )

        assert self.middleware.process_response(request, response) is response

    def test_malformed_json_request_body_does_not_raise(self):
        request = self.factory.post(
            '/api/v2/assets/', data=b'{"not": json', content_type='application/json'
        )

        assert self.middleware.process_request(request) is None

    def test_unvalidated_path_is_left_alone(self):
        request = self.factory.get('/admin/')
        response = JsonResponse({'anything': None})

        assert self.middleware.process_request(request) is None
        assert self.middleware.process_response(request, response) is response

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_undecodable_response_body_fails_in_strict_mode(self):
        request = self.factory.get('/api/v2/assets/')
        response = HttpResponse(
            b'\xff\xfe invalid utf-8', content_type='application/json'
        )

        with self.assertRaises(AssertionError):
            self.middleware.process_response(request, response)

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_malformed_json_response_body_fails_in_strict_mode(self):
        request = self.factory.get('/api/v2/assets/')
        response = HttpResponse(b'{"not": json', content_type='application/json')

        with self.assertRaises(AssertionError):
            self.middleware.process_response(request, response)

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_missing_required_request_body_fails_in_strict_mode(self):
        # `/api/v2/asset_subscriptions/` POST documents a required requestBody
        request = self.factory.post(
            '/api/v2/asset_subscriptions/', data=b'', content_type='application/json'
        )

        with self.assertRaises(AssertionError):
            self.middleware.process_request(request)

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_empty_response_body_fails_in_strict_mode(self):
        request = self.factory.get('/api/v2/assets/')
        response = HttpResponse(b'', content_type='application/json')

        with self.assertRaises(AssertionError):
            self.middleware.process_response(request, response)

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_non_json_request_body_is_not_validated(self):
        # multipart is accepted on every DRF endpoint but documented on none,
        # so it must not be reported — see README > Not validated
        request = self.factory.post(
            '/api/v2/asset_subscriptions/',
            data=b'whatever',
            content_type='multipart/form-data; boundary=x',
        )

        assert self.middleware.process_request(request) is None

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_bodyless_statuses_are_not_expected_to_carry_json(self):
        request = self.factory.get('/api/v2/assets/')

        for status_code in (204, 304):
            response = HttpResponse(
                b'', status=status_code, content_type='application/json'
            )
            assert self.middleware.process_response(request, response) is response
