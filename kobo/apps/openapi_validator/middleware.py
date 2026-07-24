import csv
import inspect
import json
import os
import re
from pathlib import Path
from typing import Any, Optional

import jsonschema
from django.conf import settings
from django.core.exceptions import MiddlewareNotUsed
from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

from kpi.exceptions import (
    OpenAPIComponentRefNotFoundError,
    OpenAPIRequiredParameterError,
)
from kpi.utils.log import logging
from .constants import API_PATH_PREFIXES, OPENAPI_VALIDATION_WHITELIST
from .utils import get_django_route


class OpenAPIValidationMiddleware(MiddlewareMixin):
    """
    Middleware to validate API requests and responses against an OpenAPI schema.
    """

    def __init__(self, get_response=None):
        super().__init__(get_response)
        if not settings.OPENAPI_VALIDATION:
            # Remove the middleware from the chain entirely when disabled
            raise MiddlewareNotUsed
        self.schema = self._load_schema()
        if not self.schema:
            raise MiddlewareNotUsed
        self.paths = self.schema.get('paths', {})
        self.components = self.schema.get('components', {})
        # Precompile OpenAPI paths ({param} placeholders → regex) once
        self.path_patterns = [
            (re.compile('^' + re.sub(r'\{[^}]+\}', '[^/]+', path) + '$'), operations)
            for path, operations in self.paths.items()
        ]
        self.ref_resolver = jsonschema.RefResolver(base_uri='', referrer=self.schema)

    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """
        Validate incoming request.
        """

        # If OPENAPI_VALIDATION is False, skip validation entirely
        if not settings.OPENAPI_VALIDATION:
            return None

        # Only validate OpenAPI endpoints
        if not request.path.startswith(API_PATH_PREFIXES):
            return None

        operation_spec = self._get_operation_spec(request.path, request.method)
        if not operation_spec:
            # No specification found, let it pass
            return None

        # Validate query parameters
        try:
            self._validate_query_parameters(operation_spec, request)
        except OpenAPIRequiredParameterError as e:
            error_message = (
                f'OpenAPI validation error for {request.path} '
                f'[{request.method}]: {str(e)}'
            )
            self._handle_validation_error(
                request, error_message, 'missing-required-parameter'
            )

        # Validate request body (for POST, PUT, PATCH)
        if request.method.upper() in ['POST', 'PUT', 'PATCH']:
            content_type = request.content_type

            if hasattr(request, 'body') and request.body:
                if 'json' in content_type.lower():
                    try:
                        body_data = json.loads(request.body.decode('utf-8'))
                    except json.JSONDecodeError:
                        error_message = (
                            f'OpenAPI validation error for {request.path} '
                            f'[{request.method}]: Invalid JSON request body'
                        )
                        self._handle_validation_error(
                            request, error_message, 'invalid-json-payload'
                        )
                        # Cannot validate a body that did not parse
                        return None

                    # Get request body schema
                    try:
                        request_schema = self._get_request_body_schema(
                            operation_spec, content_type
                        )
                    except OpenAPIComponentRefNotFoundError:
                        error_message = (
                            f'OpenAPI validation error for {request.path} '
                            f'[{request.method}]: Schema component reference not found'
                        )
                        self._handle_validation_error(
                            request, error_message, 'request-payload-schema-not-found'
                        )
                        request_schema = None

                    if request_schema and (
                        validation_error := self._validate_json_data(
                            body_data, request_schema
                        )
                    ):
                        error_message = (
                            f'OpenAPI validation error for {request.path} '
                            f'[{request.method}]: Request validation failed - '
                            f'{validation_error}'
                        )
                        self._handle_validation_error(
                            request, error_message, 'request-payload-validation'
                        )

        return None

    def process_response(
        self, request: HttpRequest, response: HttpResponse
    ) -> HttpResponse:
        """
        Validate outgoing response.
        """
        # If OPENAPI_VALIDATION is False, skip validation entirely
        if not settings.OPENAPI_VALIDATION:
            return response

        # Only validate OpenAPI endpoints
        if not request.path.startswith(API_PATH_PREFIXES):
            return response

        operation_spec = self._get_operation_spec(request.path, request.method)
        if not operation_spec:
            return response

        # Only validate JSON responses
        content_type = response.get('Content-Type', '').lower()
        if 'json' not in content_type:
            return response

        # Get response schema
        try:
            response_schema = self._get_response_schema(
                operation_spec, response.status_code, content_type
            )
        except OpenAPIComponentRefNotFoundError:
            error_message = (
                f'OpenAPI validation error for {request.path} '
                f'[{request.method}]: Schema component reference not found'
            )
            self._handle_validation_error(
                request, error_message, 'response-schema-not-found'
            )
            response_schema = None

        if response_schema:
            # Parse response content
            if hasattr(response, 'content') and response.content:
                try:
                    response_data = json.loads(response.content.decode('utf-8'))
                except json.JSONDecodeError:
                    logging.warning(
                        f'Invalid JSON response body: [{request.method}] {request.path}'
                    )
                    return response

                # Validate response
                if validation_error := self._validate_json_data(
                    response_data, response_schema
                ):
                    error_message = (
                        f'OpenAPI validation error for {request.path} '
                        f'[{request.method}]: Response validation failed - '
                        f'{validation_error}'
                    )
                    self._handle_validation_error(
                        request, error_message, 'response-validation'
                    )

        return response

    def _get_operation_spec(self, path: str, method: str) -> Optional[dict[str, Any]]:
        """
        Handles OpenAPI-style path params like {id} by converting them to a simple regex.
        """
        if not self.paths:
            return None

        method = method.lower()

        # Exact match first
        if path in self.paths and method in self.paths[path]:
            return self.paths[path][method]

        # Search with path parameters (patterns precompiled in __init__)
        for pattern, operations in self.path_patterns:
            if method in operations and pattern.match(path):
                return operations[method]

        return None

    def _get_request_body_schema(
        self, operation_spec: dict[str, Any], content_type: str
    ) -> Optional[dict[str, Any]]:
        """
        Extract the validation schema for the request body.
        """

        request_body = operation_spec.get('requestBody')
        if not request_body:
            return None

        content = request_body.get('content', {})
        media_type_spec = content.get(content_type) or content.get('application/json')

        if not media_type_spec:
            return None

        schema = media_type_spec.get('schema')

        if not schema:
            return None

        # Resolve $ref references
        if '$ref' in schema:
            if ref_schema := self._resolve_schema_ref(schema['$ref']):
                return ref_schema
            raise OpenAPIComponentRefNotFoundError

        return schema

    def _get_response_schema(
        self,
        operation_spec: dict[str, Any],
        status_code: int,
        content_type: str,
    ) -> Optional[dict[str, Any]]:
        """Extract the validation schema for the response."""
        responses = operation_spec.get('responses', {})

        # Look for exact status code or 'default'
        response_spec = responses.get(str(status_code)) or responses.get('default')
        if not response_spec:
            return None

        content = response_spec.get('content', {})
        media_type_spec = content.get(content_type) or content.get('application/json')

        if not media_type_spec:
            return None

        schema = media_type_spec.get('schema')
        if not schema:
            return None

        # Resolve $ref references

        if '$ref' in schema:
            if ref_schema := self._resolve_schema_ref(schema['$ref']):
                return ref_schema
            raise OpenAPIComponentRefNotFoundError

        return schema

    def _get_test_info(self):
        """
        Return pytest-style test identifier (file::Class::test_*) when running tests.
        Otherwise None.

        This method handles two scenarios:
        1. Direct test method execution: finds test_* methods in the stack
        2. Test setup/teardown: extracts the actual test name from _testMethodName
        """

        if not settings.TESTING:
            return None

        def relative_path(filename: str) -> str:
            for base in (Path.cwd(), Path(settings.BASE_DIR)):
                try:
                    return str(Path(filename).relative_to(base))
                except ValueError:
                    continue
            return Path(filename).name

        test_candidates = []
        try:
            for frame_info in inspect.stack():
                filename = frame_info.filename
                method_name = frame_info.frame.f_code.co_name
                instance = frame_info.frame.f_locals.get('self')

                is_test_file = '/tests/' in filename or '\\tests\\' in filename
                if method_name.startswith('test_') and is_test_file:
                    path_parts = [relative_path(filename)]
                    if instance is not None:
                        path_parts.append(instance.__class__.__name__)
                    path_parts.append(method_name)
                    test_candidates.append('::'.join(path_parts))
                elif (
                    method_name in ('setUp', 'tearDown', 'setUpClass', 'tearDownClass')
                    and instance is not None
                    and getattr(instance, '_testMethodName', None)
                ):
                    # Catch errors that occur during test setup/teardown
                    test_candidates.append(
                        f'{relative_path(filename)}::'
                        f'{instance.__class__.__name__}::'
                        f'{instance._testMethodName}'
                    )
        except Exception:
            # Never let test detection break the request cycle
            return None

        # The last candidate is the deepest in the stack, i.e. the actual test
        return test_candidates[-1] if test_candidates else None

    def _handle_validation_error(
        self,
        request: HttpRequest,
        error_message: str,
        error_code: str,
    ) -> None:
        """
        Log the validation error, optionally append it to the whitelist CSV,
        and in STRICT mode raise AssertionError unless whitelisted.
        """

        logging.warning(error_message)

        if settings.OPENAPI_VALIDATION_BUILD_WHITELIST_LOG:
            self._log_error(request, error_code)

        if not settings.OPENAPI_VALIDATION_STRICT:
            return

        test_path = self._get_test_info()

        if self._is_whitelisted(test_path, request.path, request.method, error_code):
            return

        raise AssertionError(error_message)

    def _is_whitelisted(
        self,
        test_path: str | None,
        request_path: str,
        method: str,
        error_code: str,
    ) -> bool:
        """
        Whitelist lookup using Django-resolved route only (no regex matching by us).

        Rules:
          - If test_path is None -> not whitelisted
          - Resolve request_path to django_route; only compare that route string to
            constants keys
        """
        if not test_path:
            return False

        test_entry = OPENAPI_VALIDATION_WHITELIST.get(test_path)
        if not test_entry:
            return False

        code_entry = test_entry.get(error_code)
        if not code_entry:
            return False

        django_route = get_django_route(request_path)
        if not django_route:
            return False

        allowed_methods = code_entry.get(django_route)
        if not allowed_methods:
            return False

        return method.upper() in allowed_methods

    def _load_schema(self) -> Optional[dict[str, Any]]:
        """
        Load the OpenAPI schema from JSON file.
        """

        try:
            schema_path = settings.OPENAPI_SCHEMA_PATH
            if not Path(schema_path).is_absolute():
                schema_path = Path(settings.BASE_DIR) / schema_path

            with open(schema_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logging.error(f'Error loading OpenAPI schema: {e}')
            return None

    def _log_error(self, request: HttpRequest, error_code: str):
        openapi_error_log = os.path.join(
            settings.BASE_DIR,
            'kobo',
            'apps',
            'openapi_validator',
            'scripts',
            'openapi_errors.csv',
        )
        test_info = self._get_test_info()

        if not os.path.isfile(openapi_error_log):
            with open(openapi_error_log, 'w') as f:
                writer = csv.writer(f)
                writer.writerow(['test_path', 'endpoint', 'method', 'error_code'])

        with open(openapi_error_log, 'a') as f:
            row = [
                test_info,
                request.path,
                request.method,
                error_code,
            ]
            writer = csv.writer(f)
            writer.writerow(row)

    def _resolve_schema_ref(self, ref: str) -> Optional[dict[str, Any]]:
        """Resolve a $ref reference in the schema."""
        if not ref.startswith('#/'):
            return None

        parts = ref[2:].split('/')
        schema_part = self.schema
        try:
            for part in parts:
                schema_part = schema_part[part]
            return schema_part
        except (KeyError, TypeError):
            return None

    def _validate_json_data(self, data: Any, schema: dict[str, Any]) -> str | None:
        """Validate JSON data against a schema."""
        try:
            jsonschema.validate(data, schema, resolver=self.ref_resolver)
            return None
        except jsonschema.ValidationError as e:
            return e.message
        except Exception as e:
            return str(e)

    def _validate_query_parameters(
        self, operation_spec: dict[str, Any], request: HttpRequest
    ):
        """
        Validate query parameters.
        """

        parameters = operation_spec.get('parameters', [])
        query_params = dict(request.GET)

        for param in parameters:
            if param.get('in') != 'query':
                continue

            param_name = param.get('name')
            is_required = param.get('required', False)

            if is_required and param_name not in query_params:
                raise OpenAPIRequiredParameterError(
                    f'Missing required parameter: {param_name}'
                )

        return None
