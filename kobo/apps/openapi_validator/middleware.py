import csv
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
from .constants import API_PATH_PREFIXES, OPENAPI_KNOWN_MISMATCHES
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
                    except (UnicodeDecodeError, json.JSONDecodeError):
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
                except (UnicodeDecodeError, json.JSONDecodeError):
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
        Handles OpenAPI-style path params like {id} by converting them to a
        simple regex.
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

    def _handle_validation_error(
        self,
        request: HttpRequest,
        error_message: str,
        error_code: str,
    ) -> None:
        """
        Log the validation error, optionally append it to the error CSV, and in
        STRICT mode raise AssertionError unless the mismatch is a known one.
        """

        logging.warning(error_message)

        if settings.OPENAPI_VALIDATION_BUILD_WHITELIST_LOG:
            self._log_error(request, error_code)

        if not settings.OPENAPI_VALIDATION_STRICT:
            return

        if self._is_known_mismatch(request.path, request.method, error_code):
            return

        raise AssertionError(error_message)

    def _is_known_mismatch(
        self,
        request_path: str,
        method: str,
        error_code: str,
    ) -> bool:
        """
        Whether this mismatch is already documented in OPENAPI_KNOWN_MISMATCHES.

        Lookup is done on the Django-resolved route, so it survives renamed
        tests and changes to the concrete ids in a URL.
        """
        django_route = get_django_route(request_path)
        if not django_route:
            return False

        return (error_code, django_route, method.upper()) in OPENAPI_KNOWN_MISMATCHES

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
        if not os.path.isfile(openapi_error_log):
            with open(openapi_error_log, 'w') as f:
                writer = csv.writer(f)
                writer.writerow(['endpoint', 'method', 'error_code'])

        with open(openapi_error_log, 'a') as f:
            row = [
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
