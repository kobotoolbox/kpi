import json
import re
from typing import Any, Optional
from pathlib import Path

import jsonschema
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

from kpi.utils.log import logging
from kpi.exceptions import (
    OpenAPIComponentRefNotFoundError, OpenAPIRequiredParameterError,
)


class OpenAPIValidationMiddleware(MiddlewareMixin):
    """
    Middleware to validate API requests and responses against an OpenAPI schema.
    """

    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.schema = self._load_schema()
        self.paths = self.schema.get('paths', {}) if self.schema else {}
        self.components = (
            self.schema.get('components', {}) if self.schema else {}
        )

    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """
        Validate incoming request.
        """

        # If OPENAPI_VALIDATION is False, do nothing at all
        if not settings.OPENAPI_VALIDATION:
            return None

        if not self.schema:
            return None

        # Only validate API v2 paths (starts with /api/v2/)
        if not request.path.startswith('/api/v2/'):
            return None

        operation_spec = self._get_operation_spec(request.path, request.method)
        if not operation_spec:
            # No specification found, let it pass
            return None

        # Validate query parameters
        try:
            self._validate_query_parameters(operation_spec, request)
        except OpenAPIRequiredParameterError as e:
            error_message = f'OpenAPI validation error for {request.path} [{request.method}]: {str(e)}'
            logging.warning(error_message)

            if settings.OPENAPI_VALIDATION_STRICT:
                assert False, error_message

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
                        logging.warning(error_message)

                        # Return JsonResponse only if STRICT = True
                        if settings.OPENAPI_VALIDATION_STRICT:
                            assert False, error_message

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
                        logging.warning(error_message)

                        if settings.OPENAPI_VALIDATION_STRICT:
                            assert False, error_message

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
                        logging.warning(error_message)

                        # Return JsonResponse only if STRICT = True
                        if settings.OPENAPI_VALIDATION_STRICT:
                            assert False, error_message

        return None

    def process_response(
        self, request: HttpRequest, response: HttpResponse
    ) -> HttpResponse:
        """
        Validate outgoing response.
        """
        # If OPENAPI_VALIDATION is False, do nothing at all
        if not settings.OPENAPI_VALIDATION:
            return response

        if not self.schema:
            return response

        # Only validate API v2 paths
        if not request.path.startswith('/api/v2/'):
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
            logging.warning(error_message)

            if settings.OPENAPI_VALIDATION_STRICT:
                assert False, error_message

        if response_schema:
            # Parse response content
            if hasattr(response, 'content') and response.content:
                try:
                    response_data = json.loads(response.content.decode('utf-8'))
                except json.JSONDecodeError:
                    logging.warning(f'Invalid JSON response body: [{request.method}] {request.path}')
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
                    logging.warning(error_message)

                    # Return JsonResponse only if STRICT = True
                    if settings.OPENAPI_VALIDATION_STRICT:
                        assert False, error_message

        return response

    def _get_operation_spec(
        self, path: str, method: str
    ) -> Optional[dict[str, Any]]:
        """
        Find the OpenAPI specification for a given path and method.
        Handles dynamic path parameters.
        """
        if not self.paths:
            return None

        method = method.lower()

        # Exact match first
        if path in self.paths and method in self.paths[path]:
            return self.paths[path][method]

        # Search with path parameters
        for openapi_path, operations in self.paths.items():
            if method in operations:
                # Convert OpenAPI {param} parameters to regex
                pattern = re.sub(r'\{([^}]+)\}', r'([^/]+)', openapi_path)
                pattern = f'^{pattern}$'

                if re.match(pattern, path):
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
        media_type_spec = content.get(content_type) or content.get(
            'application/json'
        )

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
        response_spec = responses.get(str(status_code)) or responses.get(
            'default'
        )
        if not response_spec:
            return None

        content = response_spec.get('content', {})
        media_type_spec = content.get(content_type) or content.get(
            'application/json'
        )

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
            logging.error(f"Error loading OpenAPI schema: {e}")
            return None

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
            # Resolve all references in the schema
            resolver = jsonschema.RefResolver(base_uri='', referrer=self.schema)
            jsonschema.validate(data, schema, resolver=resolver)
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
                raise OpenAPIRequiredParameterError(f'Missing required parameter: {param_name}')

        return None
