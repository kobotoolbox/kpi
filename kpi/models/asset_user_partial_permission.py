# coding: utf-8
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Literal, Union

from django.conf import settings
from django.db import models
from django.utils import timezone

from kpi.constants import SUFFIX_SUBMISSIONS_PERMS
from kpi.models.abstract_models import AbstractTimeStampedModel

SimplePartialPermFilter = Dict[str, str]
"""Basic filter such as my_question: my_response"""

SubmittedByPartialPermissionFilter = Dict[
    Literal['_submitted_by'], Dict[Literal['_submitted_by'], List[str]]
]
"""
Inner mongo filter for _submitted_by that accepts a subset of mongo operations
{'_submitted_by': {'$in': ['a']}}
"""

PartialPermissionFilter = Union[
    SimplePartialPermFilter, SubmittedByPartialPermissionFilter
]
"""Any valid type of partial permission filter"""

PartialPermissions = Dict[str, List[PartialPermissionFilter]]
"""
A partial permission is a permission string and it's set of filters
{
    'some_permission': [{'_submitted_by': {'$in': ['a']}}]
}
"""


def add_implied_permission(
    perms: PartialPermissions, partial_perm: str, implied_perm: str
) -> PartialPermissions:
    """
    Add implied permission for any partial perm

    implied_perm = "view_submissions"
    partial_perm = "validate_submissions"

    input_perm = {
        'view_submissions': [
            {'_submitted_by': 'someuser'},
        ],
        'validate_submissions': [
            {'my_question': 'my_response1', 'my_question2': 'my_response2'}
        ],
        'delete_submissions': [
            {'my_question': 'my_response1', 'my_question2': 'my_response2'}
        ],
    }

    returns

    {
        'view_submissions': [
            {'_submitted_by': 'someuser'},
            {'my_question': 'my_response1', 'my_question2': 'my_response2'}
        ],
        'validate_submissions': [
            {'my_question': 'my_response1', 'my_question2': 'my_response2'}
        ],
        'delete_submissions': [
            {'my_question': 'my_response1', 'my_question2': 'my_response2'}
        ],
    }
    """
    if perms_to_add := perms[partial_perm]:
        for perm_to_add in perms_to_add:
            if perm_to_add not in perms[implied_perm]:
                perms[implied_perm].append(perm_to_add)

    return perms


class AssetUserPartialPermission(AbstractTimeStampedModel):
    """
    Many-to-Many table which provides users' permissions
    on other users' submissions

    For example,
        - Asset:
            - uid: aAAAAAA
            - id: 1
        - User:
            - username: someuser
            - id: 1
    We want someuser to be able to view otheruser's submissions
    Records should be
    `permissions` is dict formatted as is:
    asset_id | user_id | permissions
        1    |    1    | {"someuser": ["view_submissions"]}

    Using a list per user for permissions, gives the opportunity to add other permissions
    such as `change_submissions`, `delete_submissions` for later purpose
    """

    class Meta:
        unique_together = [['asset', 'user']]

    asset = models.ForeignKey(
        'Asset',
        related_name='asset_partial_permissions',
        on_delete=models.CASCADE,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='user_partial_permissions',
        on_delete=models.CASCADE,
    )
    permissions = models.JSONField(default=dict)

    @staticmethod
    def update_partial_perms_to_include_implied(
        asset: 'kpi.models.Asset', partial_perms: PartialPermissions
    ) -> PartialPermissions:
        # Copy partial_perms dict as a defaultdict so that we can safely add
        # arbitrary partial permissions later
        new_partial_perms: PartialPermissions = defaultdict(list, partial_perms)

        for partial_perm, filters in partial_perms.items():
            # TODO: omit `add_submissions`? It's required at the asset
            # level for any kind of editing (e.g. partial
            # `change_submissions` requires asset-wide `add_submissions`),
            # but it doesn't make sense to restrict adding submissions
            # "only to those submissions that match some criteria"
            implied_perms: list[str] = [
                implied_perm
                for implied_perm in asset.get_implied_perms(
                    partial_perm, for_instance=asset
                )
                if implied_perm.endswith(SUFFIX_SUBMISSIONS_PERMS)
            ]

            for implied_perm in implied_perms:
                add_implied_permission(
                    new_partial_perms, partial_perm, implied_perm
                )

        return new_partial_perms
