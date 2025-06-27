from typing import Optional

from drf_spectacular.utils import OpenApiExample, OpenApiResponse
from rest_framework import serializers, status
from rest_framework.serializers import Serializer
from rest_framework.status import HTTP_200_OK

from kpi.typing_aliases import OpenApiGenericResponse


class ErrorDetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


# Returns an OpenApiResponse with the given serializer and a 200 http code
def open_api_200_ok_response(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    error_media_type: Optional[str] = 'application/json',
    **kwargs,
) -> OpenApiGenericResponse:
    return open_api_generic_response(
        status.HTTP_200_OK,
        given_serializer,
        media_type,
        require_auth=require_auth,
        validate_payload=validate_payload,
        raise_access_forbidden=raise_access_forbidden,
        raise_not_found=raise_not_found,
        error_media_type=error_media_type,
        **kwargs,
    )


# Returns an OpenApiResponse with the given serializer and a 201 http code
def open_api_201_created_response(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    error_media_type: Optional[str] = 'application/json',
    **kwargs,
) -> OpenApiGenericResponse:
    return open_api_generic_response(
        status.HTTP_201_CREATED,
        given_serializer,
        media_type,
        require_auth=require_auth,
        validate_payload=validate_payload,
        raise_access_forbidden=raise_access_forbidden,
        raise_not_found=raise_not_found,
        error_media_type=error_media_type,
        **kwargs,
    )


# Returns an OpenApiResponse with the given serializer and a 202 http code
def open_api_202_accepted_response(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    error_media_type: Optional[str] = 'application/json',
    **kwargs,
) -> OpenApiGenericResponse:
    return open_api_generic_response(
        status.HTTP_202_ACCEPTED,
        given_serializer,
        media_type,
        require_auth=require_auth,
        validate_payload=validate_payload,
        raise_access_forbidden=raise_access_forbidden,
        raise_not_found=raise_not_found,
        error_media_type=error_media_type,
        **kwargs,
    )


# Returns an OpenApiResponse with the given serializer and a 204 http code
def open_api_204_empty_response(
    media_type: Optional[str] = None,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    error_media_type: Optional[str] = 'application/json',
    **kwargs,
) -> OpenApiGenericResponse:
    return open_api_generic_response(
        status.HTTP_204_NO_CONTENT,
        media_type=media_type,
        given_serializer=None,
        require_auth=require_auth,
        validate_payload=validate_payload,
        raise_access_forbidden=raise_access_forbidden,
        raise_not_found=raise_not_found,
        error_media_type=error_media_type,
        **kwargs,
    )


def open_api_302_found(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    error_media_type: Optional[str] = 'application/json',
    **kwargs,
) -> OpenApiGenericResponse:

    return open_api_generic_response(
        status.HTTP_302_FOUND,
        given_serializer,
        media_type,
        require_auth=require_auth,
        validate_payload=validate_payload,
        raise_access_forbidden=raise_access_forbidden,
        raise_not_found=raise_not_found,
        error_media_type=error_media_type,
        **kwargs,
    )


def open_api_error_responses(
    response,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    error_media_type: str = 'application/json',
    **kwargs,
):
    if require_auth:

        response[(status.HTTP_401_UNAUTHORIZED, error_media_type)] = OpenApiResponse(
            response=ErrorDetailSerializer(),
            examples=[
                OpenApiExample(
                    name='Not authenticated',
                    value={'detail': 'Authentication credentials were not provided.'},
                    response_only=True,
                    media_type=error_media_type,
                )
            ],
        )

    if raise_access_forbidden:
        response[(status.HTTP_403_FORBIDDEN, error_media_type)] = OpenApiResponse(
            response=ErrorDetailSerializer(),
            examples=[
                OpenApiExample(
                    name='Access Denied',
                    value={
                        'detail': 'You do not have permission to perform this action.'
                    },
                    response_only=True,
                    media_type=error_media_type,
                )
            ],
        )

    if raise_not_found:
        if error_media_type == 'text/html':
            response[status.HTTP_404_NOT_FOUND] = OpenApiResponse(
                response=ErrorDetailSerializer(),
                examples=[
                    OpenApiExample(
                        name='Not Found',
                        value='404 Not Found',
                        response_only=True,
                    )
                ],
            )
        else:
            response[(status.HTTP_404_NOT_FOUND, error_media_type)] = OpenApiResponse(
                response=ErrorDetailSerializer(),
                examples=[
                    OpenApiExample(
                        name='Not Found',
                        value={'detail': 'Not found.'},
                        response_only=True,
                        media_type=error_media_type,
                    )
                ],
            )

    if validate_payload:
        validation_errors = kwargs.get(
            'validations_errors', {'field_name': ['Error message']}
        )
        response[(status.HTTP_400_BAD_REQUEST, error_media_type)] = OpenApiResponse(
            response=ErrorDetailSerializer(),
            examples=[
                OpenApiExample(
                    name='Bad request',
                    value=validation_errors,
                    response_only=True,
                    media_type=error_media_type,
                )
            ],
        )

    return response


# Generic function that builds an OpenApiResponse with the given http_code and
# given serializer.
def open_api_generic_response(
    http_code: int,
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    error_media_type: Optional[str] = 'application/json',
    **kwargs,
) -> OpenApiGenericResponse:
    success_key = http_code
    if media_type:
        success_key = (http_code, media_type)

    response = {success_key: OpenApiResponse(response=given_serializer, **kwargs)}

    return open_api_error_responses(
        response=response,
        require_auth=require_auth,
        validate_payload=validate_payload,
        raise_access_forbidden=raise_access_forbidden,
        raise_not_found=raise_not_found,
        error_media_type=error_media_type,
        **kwargs,
    )


def open_api_http_example_response(
    name: str,
    value: str,
    summary: str,
    require_auth: bool = True,
    validate_payload: bool = True,
    raise_access_forbidden: bool = True,
    raise_not_found: bool = True,
    **kwargs,
):
    response = {
        (HTTP_200_OK, 'text/html'): OpenApiResponse(
            response=str,
            examples=[
                OpenApiExample(
                    name=name,
                    value=value,
                    summary=summary,
                )
            ],
        )
    }

    return open_api_error_responses(
        response=response,
        require_auth=require_auth,
        validate_payload=validate_payload,
        raise_access_forbidden=raise_access_forbidden,
        raise_not_found=raise_not_found,
        error_media_type='text/html',
        **kwargs,
    )
