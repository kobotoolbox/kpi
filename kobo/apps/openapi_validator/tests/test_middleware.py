from unittest import mock

import jsonschema
from django.conf import settings
from django.core.exceptions import MiddlewareNotUsed
from django.http import HttpResponse, JsonResponse
from django.test import RequestFactory, TestCase, override_settings
from referencing.exceptions import Unresolvable

from kobo.apps.openapi_validator.middleware import OpenAPIValidationMiddleware


class OpenAPIValidationMiddlewareLoadTestCase(TestCase):

    @override_settings(TESTING=False, OPENAPI_VALIDATION=True)
    def test_refuses_to_load_outside_test_settings(self):
        # Django drops the middleware from the stack on MiddlewareNotUsed, so
        # a deployed environment never runs it whatever OPENAPI_VALIDATION says
        with self.assertRaises(MiddlewareNotUsed):
            OpenAPIValidationMiddleware(lambda request: HttpResponse())

    @override_settings(TESTING=True, OPENAPI_VALIDATION=False)
    def test_refuses_to_load_when_disabled(self):
        with self.assertRaises(MiddlewareNotUsed):
            OpenAPIValidationMiddleware(lambda request: HttpResponse())


@override_settings(
    OPENAPI_VALIDATION_STRICT=False,
    # The requests below are synthetic, not schema bugs: never let them reach
    # the CSV that regenerates OPENAPI_KNOWN_MISMATCHES
    OPENAPI_VALIDATION_BUILD_WHITELIST_LOG=False,
)
class OpenAPIValidationMiddlewareTestCase(TestCase):
    """
    Non-strict mode must never interrupt the request cycle: mismatches are
    logged, not raised. Strict mode (enabled in the test settings) is what
    turns them into test failures.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = OpenAPIValidationMiddleware(lambda request: HttpResponse())
        # These tests prove the raising path itself, so they must not depend
        # on which endpoints happen to be whitelisted at the time
        patcher = mock.patch(
            'kobo.apps.openapi_validator.middleware.OPENAPI_KNOWN_MISMATCHES',
            frozenset(),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

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

        # Deferred: only a mismatch once the API accepts the request
        assert self.middleware.process_request(request) is None

        with self.assertRaises(AssertionError):
            self.middleware.process_response(request, JsonResponse({}, status=201))

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_rejected_invalid_request_is_not_a_mismatch(self):
        # A test posting a bad payload on purpose to check the 400 must pass:
        # the API honored the contract by rejecting it
        request = self.factory.post(
            '/api/v2/asset_subscriptions/', data=b'{}', content_type='application/json'
        )
        response = JsonResponse({'asset': ['This field is required.']}, status=400)

        assert self.middleware.process_request(request) is None
        assert self.middleware.process_response(request, response) is response

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

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_multipart_body_is_never_read(self):
        # Reading `request.body` would buffer the upload and enforce
        # DATA_UPLOAD_MAX_MEMORY_SIZE, which Django skips for streamed multipart
        request = self.factory.post(
            '/api/v2/assets/aXYZ123/files/',
            data=b'whatever',
            content_type='multipart/form-data; boundary=x',
        )
        request.META['CONTENT_LENGTH'] = str(settings.DATA_UPLOAD_MAX_MEMORY_SIZE + 1)

        assert self.middleware.process_request(request) is None
        assert not hasattr(request, '_body')

    def test_nested_component_references_resolve(self):
        # Fragments handed to the validator are cut out of the document, so
        # their `#/components/...` references must still resolve against it
        schema = {
            'type': 'object',
            'properties': {
                'asset_type': {'$ref': '#/components/schemas/AssetTypeEnum'}
            },
        }
        validate = self.middleware._validate_json_data

        assert validate({'asset_type': 'survey'}, schema) is None
        assert validate({'asset_type': 'nope'}, schema)

    def test_broken_schema_is_not_reported_as_a_mismatch(self):
        # Tooling errors propagate instead of being returned as a message that
        # could end up whitelisted as an endpoint bug
        with self.assertRaises(jsonschema.exceptions.UnknownType):
            self.middleware._validate_json_data({}, {'type': 'no-such-type'})

        with self.assertRaises(Unresolvable):
            self.middleware._validate_json_data(
                {}, {'$ref': '#/components/schemas/DoesNotExist'}
            )


class OpenAPIValidationMiddlewareChainTestCase(TestCase):
    """
    Through the real middleware stack, with the Django test client: proves the
    MIDDLEWARE entry and that a strict-mode failure raised on the way out
    reaches the test that made the request.
    """

    @override_settings(OPENAPI_VALIDATION_STRICT=True)
    def test_response_mismatch_fails_the_calling_test(self):
        with (
            mock.patch(
                'kobo.apps.openapi_validator.middleware.OPENAPI_KNOWN_MISMATCHES',
                frozenset(),
            ),
            mock.patch.object(
                OpenAPIValidationMiddleware,
                '_validate_json_data',
                return_value='boom',
            ),
            self.assertRaises(AssertionError) as cm,
        ):
            # Anonymous GET: a documented 401 with a JSON body
            self.client.get('/me/')

        assert 'OpenAPI validation error for /me/ [GET]' in str(cm.exception)
        assert 'boom' in str(cm.exception)
