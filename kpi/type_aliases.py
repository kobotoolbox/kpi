from typing import TypeAlias, Union

from django.db.models import Model
from drf_spectacular.utils import OpenApiResponse

# A Django model class (not an instance), e.g. `Asset` or `User`
ModelClass: TypeAlias = type[Model]

OpenApiGenericResponse = dict[Union[int, tuple[int, str]], OpenApiResponse]
