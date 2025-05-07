from typing import Optional

from drf_spectacular.utils import OpenApiResponse
from rest_framework import status
from rest_framework.serializers import Serializer

from kpi.typing_aliases import OpenApiGenericResponse


# Generic function that builds an OpenApiResponse with the given http_code and
# given serializer.
def open_api_generic_response(
    http_code: str,
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
) -> OpenApiGenericResponse:
    if media_type:
        return {(http_code, media_type): OpenApiResponse(response=given_serializer)}

    return {http_code: OpenApiResponse(response=given_serializer)}


def open_api_media_generic_response(
    http_code: str,
    media_type: str,
    given_serializer: Optional[Serializer] = None,
) -> dict:
    return {(http_code, media_type): given_serializer}

# Returns an OpenApiResponse with the given serializer and a 200 http code
def open_api_200_ok_response(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
) -> OpenApiGenericResponse:
    return open_api_generic_response(status.HTTP_200_OK, given_serializer, media_type,)


# Returns an OpenApiResponse with the given serializer and a 201 http code
def open_api_201_created_response(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
) -> OpenApiGenericResponse:
    return open_api_generic_response(
        status.HTTP_201_CREATED, given_serializer, media_type,
    )


# Returns an OpenApiResponse with the given serializer and a 202 http code
def open_api_202_accepted_response(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
) -> OpenApiGenericResponse:
    return open_api_generic_response(
        status.HTTP_202_ACCEPTED, given_serializer, media_type,
    )


# Returns an OpenApiResponse with the given serializer and a 204 http code
def open_api_204_empty_response(
    media_type: Optional[str] = None,
) -> OpenApiGenericResponse:
    return open_api_generic_response(
        status.HTTP_204_NO_CONTENT, media_type=media_type, given_serializer=None
    )

def open_api_302_found(
    given_serializer: Optional[Serializer] = None,
    media_type: Optional[str] = None,
) -> OpenApiGenericResponse:

    return open_api_generic_response(
        status.HTTP_302_FOUND, given_serializer, media_type,
    )
