from typing import Callable, TypeAlias, TypedDict, Union

from django.db import models

# A list of object identifiers
ObjectIdentifiers: TypeAlias = list[str | int]

# Return type: a Django QuerySet and an integer (e.g., number of updated records)
UpdatedQuerySetAndCount: TypeAlias = tuple[models.QuerySet, int]

# Represents a class reference to a trash model (anyone which extends BaseTrash).
# This is used when working with the model itself (e.g., for .objects operations).
TrashBinModel: TypeAlias = Union['trash_bin.AccountTrash', 'trash_bin.ProjectTrash']

# Represents an instance of a trash model (anyone which extends BaseTrash).
# Shares the same underlying types as TrashBinModel, but this alias clarifies that we
# expect an instance.
TrashBinModelInstance: TypeAlias = TrashBinModel

# A callback function that takes a TrashBinModelInstance and returns nothing.
# Used to define pre-deletion or deletion logic for a specific object.
DeletionCallback: TypeAlias = Callable[[TrashBinModel], None]


class AttachmentTrashDict(TypedDict):
    pk: int
    attachment_uid: str
    attachment_basename: str


class ProjectTrashDict(TypedDict):
    pk: int
    asset_uid: str
    asset_name: str


class AccountTrashDict(TypedDict):
    pk: int
    username: str


TrashObject: TypeAlias = AccountTrashDict | ProjectTrashDict | AttachmentTrashDict
