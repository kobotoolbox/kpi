from drf_spectacular.utils import OpenApiResponse
from rest_framework import status
from rest_framework.serializers import Serializer

from kpi.typing_aliases import OpenApiGenericResponse


# Generic function that builds an OpenApiResponse with the given http_code and
# given serializer.
def open_api_generic_response(
    http_code: str, given_serializer: Serializer
) -> OpenApiGenericResponse:
    return {http_code: OpenApiResponse(response=given_serializer)}


# Returns an OpenApiResponse with the given serializer and a 200 http code
def open_api_200_ok_response(given_serializer: Serializer) -> OpenApiGenericResponse:
    return open_api_generic_response(status.HTTP_200_OK, given_serializer)


# Returns an OpenApiResponse with the given serializer and a 201 http code
def open_api_201_created_response(
    given_serializer: Serializer,
) -> OpenApiGenericResponse:
    return open_api_generic_response(status.HTTP_201_CREATED, given_serializer)


# Returns an OpenApiResponse with the given serializer and a 202 http code
def open_api_202_accepted_response(
    given_serializer: Serializer,
) -> OpenApiGenericResponse:
    return open_api_generic_response(status.HTTP_202_ACCEPTED, given_serializer)


# Returns an OpenApiResponse with the given serializer and a 204 http code
def open_api_204_empty_response(given_serializer: Serializer) -> OpenApiGenericResponse:
    return open_api_generic_response(status.HTTP_204_NO_CONTENT, given_serializer)
