# coding: utf-8
from collections import defaultdict

from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.utils import timezone

from kpi.constants import SUFFIX_SUBMISSIONS_PERMS
from kpi.utils.mongo_helper import MongoHelper


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
        unique_together = [['asset', 'user']]

    asset = models.ForeignKey('Asset', related_name='asset_partial_permissions',
                              on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', related_name='user_partial_permissions',
                             on_delete=models.CASCADE)
    permissions = JSONBField(default=dict)
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):

        if self.pk is not None:
            self.date_modified = timezone.now()

        super().save(*args, **kwargs)

    @staticmethod
    def update_partial_perms_to_include_implied(
        asset: 'kpi.models.Asset', partial_perms: dict
    ) -> dict:
        new_partial_perms = defaultdict(list)
        in_op = MongoHelper.IN_OPERATOR

        for partial_perm, filters in partial_perms.items():

            if partial_perm not in new_partial_perms:
                new_partial_perms[partial_perm] = filters

            # TODO: omit `add_submissions`? It's required at the asset
            # level for any kind of editing (e.g. partial
            # `change_submissions` requires asset-wide `add_submissions`),
            # but it doesn't make sense to restrict adding submissions
            # "only to those submissions that match some criteria"
            implied_perms = [
                implied_perm
                for implied_perm in asset.get_implied_perms(
                    partial_perm, for_instance=asset
                )
                if implied_perm.endswith(SUFFIX_SUBMISSIONS_PERMS)
            ]

            for implied_perm in implied_perms:

                if (
                    implied_perm not in new_partial_perms
                    and implied_perm in partial_perms
                ):
                    new_partial_perms[implied_perm] = partial_perms[
                        implied_perm
                    ]

                new_partial_perm = new_partial_perms[implied_perm]
                # Trivial case, i.e.: permissions are built with front end.
                # All permissions have only one filter and the same filter
                # Example:
                # ```
                # partial_perms = {
                #   'view_submissions' : [
                #       {'_submitted_by': {'$in': ['johndoe']}}
                #   ],
                #   'delete_submissions':  [
                #       {'_submitted_by': {'$in': ['quidam']}}
                #   ]
                # }
                # ```
                # should give
                # ```
                # new_partial_perms = {
                #   'view_submissions' : [
                #       {'_submitted_by': {'$in': ['johndoe', 'quidam']}}
                #   ],
                #   'delete_submissions':  [
                #       {'_submitted_by': {'$in': ['quidam']}}
                #   ]
                # }
                if (
                    len(filters) == 1
                    and len(new_partial_perm) == 1
                    and isinstance(new_partial_perm, list)
                ):
                    current_filters = new_partial_perms[implied_perm][0]
                    filter_ = filters[0]
                    # Front end only supports `_submitted_by`, but if users
                    # use the API, it could be something else.
                    filter_key = list(filter_)[0]
                    try:
                        new_value = filter_[filter_key][in_op]
                        current_values = current_filters[filter_key][in_op]
                    except (KeyError, TypeError):
                        pass
                    else:
                        new_partial_perm[0][filter_key][in_op] = list(
                            set(current_values + new_value)
                        )
                        continue

                # As said earlier, front end only supports `'_submitted_by'`
                # filter, but many different and more complex filters could
                # be used.
                # If we reach these lines, it means conditions cannot be
                # merged, so we concatenate then with an `OR` operator.
                # Example:
                # ```
                # partial_perms = {
                #   'view_submissions' : [{'_submitted_by': 'johndoe'}],
                #   'delete_submissions':  [
                #       {'_submission_date': {'$lte': '2021-01-01'},
                #       {'_submission_date': {'$gte': '2020-01-01'}
                #   ]
                # }
                # ```
                # should give
                # ```
                # new_partial_perms = {
                #   'view_submissions' : [
                #           [{'_submitted_by': 'johndoe'}],
                #           [
                #               {'_submission_date': {'$lte': '2021-01-01'},
                #               {'_submission_date': {'$gte': '2020-01-01'}
                #           ]
                #   },
                #   'delete_submissions':  [
                #       {'_submission_date': {'$lte': '2021-01-01'},
                #       {'_submission_date': {'$gte': '2020-01-01'}
                #   ]
                # }

                # To avoid more complexity (and different syntax than
                # trivial case), we delegate to MongoHelper the task to join
                # lists with the `$or` operator.
                try:
                    new_partial_perm = new_partial_perms[implied_perm][0]
                except IndexError:
                    # If we get an IndexError, implied permission does not
                    # belong to current assignment. Let's copy the filters
                    #
                    new_partial_perms[implied_perm] = filters
                else:
                    if not isinstance(new_partial_perm, list):
                        new_partial_perms[implied_perm] = [
                            filters,
                            new_partial_perms[implied_perm],
                        ]
                    else:
                        new_partial_perms[implied_perm].append(filters)

        return new_partial_perms
