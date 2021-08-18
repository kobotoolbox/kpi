# coding: utf-8
import abc
import copy
import json
from typing import Union, Iterator

from bson import json_util
from django.db.models.query import QuerySet
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from django.core.exceptions import PermissionDenied
from rest_framework import serializers
from rest_framework.pagination import _positive_int as positive_int
from shortuuid import ShortUUID

from kpi.constants import (
    SUBMISSION_FORMAT_TYPE_XML,
    SUBMISSION_FORMAT_TYPE_JSON,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models.asset_file import AssetFile
from kpi.models.paired_data import PairedData
from kpi.utils.jsonbfield_helper import ReplaceValues


class BaseDeploymentBackend(abc.ABC):
    """
    Defines the interface for a deployment backend.
    """

    def __init__(self, asset):
        self.asset = asset
        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        self.current_submissions_count = 0
        self.__stored_data_key = None

    @property
    def active(self):
        return self.get_data('active', False)

    @property
    def backend(self):
        return self.get_data('backend')

    @property
    def backend_response(self):
        return self.get_data('backend_response', {})

    @abc.abstractmethod
    def bulk_assign_mapped_perms(self):
        pass

    @abc.abstractmethod
    def bulk_update_submissions(
        self, data: dict, user: 'auth.User'
    ) -> dict:
        pass

    @abc.abstractmethod
    def calculated_submission_count(self, user: 'auth.User', **kwargs):
        pass

    @abc.abstractmethod
    def connect(self, active=False):
        pass

    def delete(self):
        self.asset._deployment_data.clear()  # noqa

    def get_data(
        self, dotted_path: str = None, default=None
    ) -> Union[None, int, str, dict]:
        """
        Access `self.asset._deployment_data` and return corresponding value of
        `dotted_path` if it exists. Otherwise, it returns `default`.
        If `dotted_path` is not provided, it returns the whole
        dictionary.
        """
        if not dotted_path:
            # We do not want to return the mutable object whose could be altered
            # later. `self.asset._deployment_data` should never be accessed
            # directly
            deployment_data_copy = copy.deepcopy(self.asset._deployment_data)  # noqa
            deployment_data_copy.pop('_stored_data_key', None)
            return deployment_data_copy

        value = None
        nested_path = dotted_path.split('.')
        nested_dict = self.asset._deployment_data  # noqa
        for key in nested_path:
            try:
                value = nested_dict[key]
            except KeyError:
                return default

            nested_dict = value

        return value

    @abc.abstractmethod
    def delete_submission(self, submission_id: int, user: 'auth.User') -> dict:
        pass

    @abc.abstractmethod
    def delete_submissions(self, data: dict, user: 'auth.User', **kwargs) -> dict:
        pass

    @abc.abstractmethod
    def duplicate_submission(
        self,  submission_id: int, user: 'auth.User'
    ) -> dict:
        pass

    @abc.abstractmethod
    def get_data_download_links(self):
        pass

    @abc.abstractmethod
    def get_enketo_submission_url(
        self, submission_id: int, user: 'auth.User', params: dict = None
    ) -> dict:
        """
        Return a formatted dict to be passed to a Response object
        """
        pass

    @abc.abstractmethod
    def get_enketo_survey_links(self):
        pass

    def get_submission(self,
                       submission_id: int,
                       user: 'auth.User',
                       format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
                       **mongo_query_params: dict) -> Union[dict, str, None]:
        """
        Retrieve the corresponding submission whose id equals `submission_id`
        and which `user` is allowed to access.

        The format `format_type` can be either:
        - 'json' (See `kpi.constants.SUBMISSION_FORMAT_TYPE_JSON`)
        - 'xml' (See `kpi.constants.SUBMISSION_FORMAT_TYPE_XML`)

        MongoDB filters can be passed through `mongo_query_params` to narrow
        down the result.

        If `user` has no access to that submission or no matches are found,
        `None` is returned.
        If `format_type` is 'json', a dictionary is returned.
        Otherwise, if `format_type` is 'xml', a string is returned.
        """

        submissions = list(
            self.get_submissions(
                user, format_type, [int(submission_id)], **mongo_query_params
            )
        )
        try:
            return submissions[0]
        except IndexError:
            pass
        return None

    @abc.abstractmethod
    def get_submission_detail_url(self, submission_id: int) -> str:
        pass

    def get_submission_validation_status_url(self, submission_id: int) -> str:
        url = '{detail_url}validation_status/'.format(
            detail_url=self.get_submission_detail_url(submission_id)
        )
        return url

    @abc.abstractmethod
    def get_submissions(
        self,
        user: 'auth.User',
        format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
        submission_ids: list = [],
        **mongo_query_params: dict
    ) -> Union[Iterator[dict], Iterator[str]]:
        """
        Retrieve submissions that `user` is allowed to access.

        The format `format_type` can be either:
        - 'json' (See `kpi.constants.SUBMISSION_FORMAT_TYPE_JSON`)
        - 'xml' (See `kpi.constants.SUBMISSION_FORMAT_TYPE_XML`)

        Results can be filtered by submission ids. Moreover MongoDB filters can
        be passed through `mongo_query_params` to narrow down the results.

        If `user` has no access to these submissions or no matches are found, an
        empty iterator is returned.

        If `format_type` is 'json', an iterator of dictionaries is returned.
        Otherwise, if `format_type` is 'xml', an iterator of strings is returned.
        """
        pass

    @abc.abstractmethod
    def get_validation_status(self, submission_id: int, user: 'auth.User') -> dict:
        """
        Return a formatted dict to be passed to a Response object
        """
        pass

    @property
    def identifier(self):
        return self.get_data('identifier')

    @property
    def last_submission_time(self):
        return self._last_submission_time()

    @property
    def mongo_userform_id(self):
        return None

    @abc.abstractmethod
    def redeploy(self, active: bool = None):
        pass

    def remove_from_kc_only_flag(self, *args, **kwargs):
        # TODO: This exists only to support KoBoCAT (see #1161) and should be
        # removed, along with all places where it is called, once we remove
        # KoBoCAT's ability to assign permissions (kobotoolbox/kobocat#642)

        # Do nothing, without complaint, so that callers don't have to worry
        # about whether the back end is KoBoCAT or something else
        pass

    def save_to_db(self, updates: dict):
        """
        Persist values from deployment data into the DB.
        `updates` is a dictionary of properties to update.
        E.g: `{"active": True, "status": "not-synced"}`
        """
        # Avoid circular imports
        # use `self.asset.__class__` instead of `from kpi.models import Asset`
        now = timezone.now()
        self.asset.__class__.objects.filter(id=self.asset.pk).update(
            _deployment_data=ReplaceValues(
                '_deployment_data',
                updates=updates,
            ),
            date_modified=now,
        )
        self.store_data(updates)
        self.asset.date_modified = now

    @abc.abstractmethod
    def set_active(self, active: bool):
        pass

    @abc.abstractmethod
    def set_asset_uid(self, **kwargs) -> bool:
        pass

    @abc.abstractmethod
    def set_has_kpi_hooks(self):
        pass

    def set_status(self, status):
        self.save_to_db({'status': status})

    @abc.abstractmethod
    def set_validation_status(self,
                              submission_id: int,
                              user: 'auth.User',
                              data: dict,
                              method: str) -> dict:
        pass

    @abc.abstractmethod
    def set_validation_statuses(self, user: 'auth.User', data: dict) -> dict:
        pass

    @property
    def status(self):
        return self.get_data('status')

    def store_data(self, values: dict):
        self.__stored_data_key = ShortUUID().random(24)
        values['_stored_data_key'] = self.__stored_data_key
        self.asset._deployment_data.update(values)  # noqa

    @property
    def stored_data_key(self):
        return self.__stored_data_key

    @property
    def submission_count(self):
        return self.calculated_submission_count(self.asset.owner)

    @property
    @abc.abstractmethod
    def submission_list_url(self):
        pass

    @abc.abstractmethod
    def sync_media_files(self, file_type: str = AssetFile.FORM_MEDIA):
        pass

    def validate_submission_list_params(
        self,
        user: 'auth.User',
        format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
        validate_count: bool = False,
        partial_perm=PERM_VIEW_SUBMISSIONS,
        **mongo_query_params
    ) -> dict:
        """
        Validates parameters (`mongo_query_params`) to be passed to MongoDB.
        parameters can be:
            - start
            - limit
            - sort
            - fields
            - query
            - submission_ids
        If `validate_count` is True,`start`, `limit`, `fields` and `sort` are
        ignored.
        If `user` has partial permissions, conditions are
        applied to the query to narrow down results to what they are allowed
        to see. Partial permissions are validated with 'view_submissions' by
        default. To check with another permission, pass a different permission
        to `partial_perm`.
        """

        if 'count' in mongo_query_params:
            raise serializers.ValidationError(
                {
                    'count': _(
                        'This param is not implemented. Use `count` property '
                        'of the response instead.'
                    )
                }
            )

        if validate_count is False and format_type == SUBMISSION_FORMAT_TYPE_XML:
            if 'sort' in mongo_query_params:
                # FIXME. Use Mongo to sort data and ask PostgreSQL to follow the order
                # See. https://stackoverflow.com/a/867578
                raise serializers.ValidationError({
                    'sort': _('This param is not supported in `XML` format')
                })

            if 'fields' in mongo_query_params:
                raise serializers.ValidationError({
                    'fields': _('This is not supported in `XML` format')
                })

        start = mongo_query_params.get('start', 0)
        limit = mongo_query_params.get('limit')
        sort = mongo_query_params.get('sort', {})
        fields = mongo_query_params.get('fields', [])
        query = mongo_query_params.get('query', {})
        submission_ids = mongo_query_params.get('submission_ids', [])

        # I've copied these `ValidationError` messages verbatim from DRF where
        # possible.TODO: Should this validation be in (or called directly by)
        # the view code? Does DRF have a validator for GET params?

        if isinstance(query, str):
            try:
                query = json.loads(query, object_hook=json_util.object_hook)
            except ValueError:
                raise serializers.ValidationError(
                    {'query': _('Value must be valid JSON.')}
                )

        if not isinstance(submission_ids, list):

            raise serializers.ValidationError(
                {'submission_ids': _('Value must be a list.')}
            )

        # This error should not be returned as `ValidationError` to user.
        # We want to return a 500.
        try:
            permission_filters = self.asset.get_filters_for_partial_perm(
                user.pk, perm=partial_perm)
        except ValueError:
            raise ValueError('Invalid `user_id` param')

        if validate_count:
            return {
                'query': query,
                'submission_ids': submission_ids,
                'permission_filters': permission_filters
            }

        if isinstance(sort, str):
            try:
                sort = json.loads(sort, object_hook=json_util.object_hook)
            except ValueError:
                raise serializers.ValidationError(
                    {'sort': _('Value must be valid JSON.')}
                )

        try:
            start = positive_int(start)
        except ValueError:
            raise serializers.ValidationError(
                {'start': _('A positive integer is required.')}
            )
        try:
            if limit is not None:
                limit = positive_int(limit, strict=True)
        except ValueError:
            raise serializers.ValidationError(
                {'limit': _('A positive integer is required.')}
            )

        if isinstance(fields, str):
            try:
                fields = json.loads(fields, object_hook=json_util.object_hook)
            except ValueError:
                raise serializers.ValidationError(
                    {'fields': _('Value must be valid JSON.')}
                )

        params = {
            'query': query,
            'start': start,
            'fields': fields,
            'sort': sort,
            'submission_ids': submission_ids,
            'permission_filters': permission_filters
        }

        if limit:
            params['limit'] = limit

        return params

    def validate_write_access_with_partial_perms(
        self,
        user: 'auth.User',
        perm: str,
        submission_ids: list = [],
        query: dict = {},
    ) -> list:
        """
        Validate whether `user` is allowed to perform write actions on
        submissions with the permission `perm`.
        It raises a `PermissionDenied` error if they cannot.

        Return a list of valid submission ids to pass to back end

        No validations are made whether `user` is granted with other permissions
        than 'partial_submission' permission.
        """
        if PERM_PARTIAL_SUBMISSIONS not in self.asset.get_perms(user):
            return

        allowed_submission_ids = []

        if not submission_ids:
            # if no submission ids are provided, the back end must rebuild the
            # query to retrieve the related submissions. Unfortunately, the
            # current back end (KoBoCAT) does not support row level permissions.
            # Thus, we need to fetch all the submissions the user is allowed to
            # see in order to to compare the requested subset of submissions to
            # all
            all_submissions = self.get_submissions(
                user=user,
                partial_perm=perm,
                fields=['_id'],
            )
            allowed_submission_ids = [r['_id'] for r in all_submissions]

            # User should see at least one submission to be allowed to do
            # something
            if not allowed_submission_ids:
                raise PermissionDenied

            # if `query` is not provided, the action is performed on all
            # submissions. There are no needs to go further.
            if not query:
                return allowed_submission_ids

        submissions = self.get_submissions(
            user=user,
            partial_perm=perm,
            fields=['_id'],
            submission_ids=submission_ids,
            query=query,
        )

        requested_submission_ids = [
            r['_id'] for r in submissions
        ]

        if not requested_submission_ids:
            raise PermissionDenied

        submission_ids = [int(id_) for id_ in set(submission_ids)]
        if (
            (allowed_submission_ids
             and set(requested_submission_ids).issubset(allowed_submission_ids))
            or sorted(requested_submission_ids) == sorted(submission_ids)
        ):
            # Regardless of whether or not the request contained a query or a
            # list of IDs, always return IDs here because the results of a
            # query may contain submissions that the requesting user is not
            # allowed to access. For example,
            #   - In submissions 4, 5, and 6, the response to the "state"
            #       question was "California"
            #   - Bob is allowed to access only submissions made by Jerry
            #   - Jerry uploaded submissions 5, 6, and 7
            #   - Bob submits a query for all submissions where
            #       `{"state": "California"}`
            #   - Bob must only see submissions 5 and 6

            return requested_submission_ids

        raise PermissionDenied

    @property
    def version(self):
        raise NotImplementedError('Use `asset.deployment.version_id`')

    @property
    def version_id(self):
        return self.get_data('version')

    def _get_metadata_queryset(self, file_type: str) -> Union[QuerySet, list]:
        """
        Returns a list of objects, or a QuerySet to pass to Celery to
        synchronize with the backend.
        Can be used inside the implementation of `sync_media_files()`
        """
        if file_type == AssetFile.FORM_MEDIA:
            # Order by `date_deleted` to process deleted files first in case
            # two entries contain the same file but one is flagged as deleted
            return self.asset.asset_files.filter(
                file_type=AssetFile.FORM_MEDIA
            ).order_by('date_deleted')
        else:
            queryset = PairedData.objects(self.asset).values()
            return queryset
