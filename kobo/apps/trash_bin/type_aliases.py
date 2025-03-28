from typing import TypeAlias
from django.db import models

# Represents a single object identifier: either a string or an integer
ObjectIdentifier: TypeAlias = str | int

# A list of object identifiers
ObjectIdentifierList: TypeAlias = list[ObjectIdentifier]

# Return type: a Django QuerySet and an integer (e.g., number of updated records)
ToggleStatusesReturn: TypeAlias = tuple[models.QuerySet, int]
