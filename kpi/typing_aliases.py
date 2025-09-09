from typing import Union

from drf_spectacular.utils import OpenApiResponse

OpenApiGenericResponse = dict[Union[int, tuple[int, str]], OpenApiResponse]
