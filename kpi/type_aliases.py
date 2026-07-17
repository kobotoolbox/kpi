from typing import TypeAlias, Union

from django.db.models import Model
from drf_spectacular.utils import OpenApiResponse

# A Django model class (not an instance), e.g. `Asset` or `User`
ModelClass: TypeAlias = type[Model]

# A map of Django `app_label.model_name` -> the set of field names that may be
# traversed on that model in a `q` lookup path (allowlist / denylist / overrides)
LookupFieldsMap: TypeAlias = dict[str, frozenset[str]]

OpenApiGenericResponse = dict[Union[int, tuple[int, str]], OpenApiResponse]
