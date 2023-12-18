# coding: utf-8
from __future__ import annotations
from collections import defaultdict
from typing import Literal, Union

from django.db import models
from django.utils import timezone

from kpi.constants import SUFFIX_SUBMISSIONS_PERMS


SimplePartialPermFilter = dict[str, str]
"""Basic filter such as my_question: my_response"""

SubmittedByPartialPermissionFilter = dict[
    Literal["_submitted_by"], dict[Literal["_submitted_by"], list[str]]
]
"""
Inner mongo filter for _submitted_by that accepts a subset of mongo operations
{'_submitted_by': {'$in': ['a']}}
"""

PartialPermissionFilter = Union[
    SimplePartialPermFilter, SubmittedByPartialPermissionFilter
]
"""Any valid type of partial permission filter"""

PartialPermissions = dict[str, list[list[PartialPermissionFilter]]]
"""
A partial permission is a permission string and it's set of filters
{
    'some_permission': [[{'_submitted_by': {'$in': ['a']}}]]
}
"""

LegacyPartialPermissions = dict[
    str, list[Union[list[PartialPermissionFilter], SubmittedByPartialPermissionFilter]]
]
"""Older partial permissions use format like 'some_permission': [{'_submitted_by': {'$in': ['a']}}]"""


def normalize_permissions(permissions: LegacyPartialPermissions) -> PartialPermissions:
    """
    Normalize permissions to meet expectations for our UI and limited set of supported permissions
    This may change in the future to support additional and more complex filters
    """
    return {
        key: [
            [filter_dict] if isinstance(filter_dict, dict) else filter_dict
            for filter_dict in filter_list
        ]
        for key, filter_list in permissions.items()
    }


def add_implied_permission(
    perms: PartialPermissions, partial_perm: str, implied_perm: str
) -> PartialPermissions:
    """
    Add implied permission for any partial perm

    implied_perm = "view_submissions"
    partial_perm = "validate_submissions"

    input_perm = {
        'view_submissions': [{'_submitted_by': {'$in': ['a']}}],
        'validate_submissions': [
            [{'my_question': 'my_response1'}, {'my_question2': 'my_response2'}]
        ],
        'delete_submissions': [
            [{'my_question': 'my_response1'}, {'my_question2': 'my_response2'}],
            {'_submitted_by': {'$in': ['v']}}
        ],
    }

    returns

    {
        'view_submissions': [
            [{'_submitted_by': 'someuser'}],
            [{'my_question': 'my_response1'}, {'my_question2': 'my_response2'}],
        ],
        'validate_submissions': [
            [{'my_question': 'my_response1'}, {'my_question2': 'my_response2'}]
        ],
        'delete_submissions': [
            [{'my_question': 'my_response1'}, {'my_question2': 'my_response2'}]
        ],
    }
    """
    if perms_to_add := perms[partial_perm]:
        for perm_to_add in perms_to_add:
            if perm_to_add not in perms[implied_perm]:
                perms[implied_perm].append(perm_to_add)

    return perms


class AssetUserPartialPermission(models.Model):
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
        unique_together = [["asset", "user"]]

    asset = models.ForeignKey(
        "Asset", related_name="asset_partial_permissions", on_delete=models.CASCADE
    )
    user = models.ForeignKey(
        "auth.User", related_name="user_partial_permissions", on_delete=models.CASCADE
    )
    permissions = models.JSONField(default=dict)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):
        if self.pk is not None:
            self.date_modified = timezone.now()

        super().save(*args, **kwargs)

    @staticmethod
    def update_partial_perms_to_include_implied(
        asset: "kpi.models.Asset", partial_perms: LegacyPartialPermissions
    ) -> PartialPermissions:
        # Copy partial_perms dict as a defaultdict so that we can safely add
        # arbitrary partial permissions later
        new_partial_perms: PartialPermissions = defaultdict(
            list, normalize_permissions(partial_perms)
        )

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
                add_implied_permission(new_partial_perms, partial_perm, implied_perm)

        return new_partial_perms
