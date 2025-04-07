from typing import TypeAlias
from django.db import models

# A list of object identifiers
ObjectIdentifiers: TypeAlias = list[str | int]

# Return type: a Django QuerySet and an integer (e.g., number of updated records)
UpdatedQuerySetAndCount: TypeAlias = tuple[models.QuerySet, int]
