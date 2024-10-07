# coding: utf-8
from __future__ import annotations

import abc
import copy
import datetime
import json
import os
import uuid
from contextlib import contextmanager
from datetime import date
from typing import Iterator, Optional, Union

from bson import json_util
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.db.models.query import QuerySet
from django.utils import timezone
from django.utils.translation import gettext_lazy as t
from rest_framework import serializers
from rest_framework.pagination import _positive_int as positive_int
from rest_framework.reverse import reverse
from shortuuid import ShortUUID

from kobo.apps.openrosa.libs.utils.logger_tools import http_open_rosa_error_handler
from kpi.constants import (
    PERM_CHANGE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
    SUBMISSION_FORMAT_TYPE_JSON,
    SUBMISSION_FORMAT_TYPE_XML,
)
from kpi.exceptions import BulkUpdateSubmissionsClientException
from kpi.models.asset_file import AssetFile
from kpi.models.paired_data import PairedData
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes
from kpi.utils.submission import get_attachment_filenames_and_xpaths
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    get_or_create_element,
    xml_tostring,
)


class BaseDeploymentBackend(abc.ABC):
    """
    Defines the interface for a deployment backend.
    """

    PROTECTED_XML_FIELDS = [
        '__version__',
        'formhub',
        'meta',
    ]

    # XPaths are relative to the root node
    SUBMISSION_CURRENT_UUID_XPATH = 'meta/instanceID'
    SUBMISSION_DEPRECATED_UUID_XPATH = 'meta/deprecatedID'
    FORM_UUID_XPATH = 'formhub/uuid'

    def __init__(self, asset):
        self.asset = asset
        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        self.current_submission_count = 0
        self.__stored_data_key = None

    @property
    def active(self):
        return self.get_data('active', False)

    @property
    @abc.abstractmethod
    def attachment_storage_bytes(self):
        pass

    @property
    def backend(self):
        return self.get_data('backend')

    @property
    def backend_response(self):
        return self.get_data('backend_response', {})

    @abc.abstractmethod
    def bulk_assign_mapped_perms(self):
        pass

    def bulk_update_submissions(
        self, data: dict, user: settings.AUTH_USER_MODEL, **kwargs
    ) -> dict:
        """
        Allows for bulk updating (bulk editing) of submissions. A
        `deprecatedID` for each submission is given the previous value of
        `instanceID` and `instanceID` receives an updated uuid. For each key
        and value within `request_data`, either a new element is created on the
        submission's XML tree, or the existing value is replaced by the updated
        value.

        Args:
            data (dict): must contain a list of `submission_ids` and at
                least one other key:value field for updating the submissions
            user (User)

        Returns:
            dict: formatted dict to be passed to a Response object
        """
        submission_ids = self.validate_access_with_partial_perms(
            user=user,
            perm=PERM_CHANGE_SUBMISSIONS,
            submission_ids=data['submission_ids'],
            query=data['query'],
        )

        # If `submission_ids` is not empty, user has partial permissions.
        # Otherwise, they have full access.
        if submission_ids:
            # Reset query, because all the submission ids have been already
            # retrieve
            data['query'] = {}

            # Set `has_partial_perms` flag on `request.user` to grant them
            # permissions while calling `logger_tool.py::_has_edit_xform_permission()`
            if request := kwargs.get('request'):
                request.user.has_partial_perms = True
        else:
            submission_ids = data['submission_ids']

        submissions = self.get_submissions(
            user=user,
            format_type=SUBMISSION_FORMAT_TYPE_XML,
            submission_ids=submission_ids,
            query=data['query'],
        )

        if not self.current_submission_count:
            raise BulkUpdateSubmissionsClientException(
                detail=t('No submissions match the given `submission_ids`')
            )

        # Remove potentially destructive keys from the payload
        update_data = copy.deepcopy(data['data'])
        update_data = {
            k: v
            for k, v in update_data.items()
            if not (
                k in self.PROTECTED_XML_FIELDS
                or '/' in k
                and k.split('/')[0] in self.PROTECTED_XML_FIELDS
            )
        }

        backend_results = []
        for submission in submissions:
            xml_parsed = fromstring_preserve_root_xmlns(submission)

            _uuid, uuid_formatted = self.generate_new_instance_id()

            # Updating xml fields for submission. In order to update an existing
            # submission, the current `instanceID` must be moved to the value
            # for `deprecatedID`.
            instance_id = get_or_create_element(
                xml_parsed, self.SUBMISSION_CURRENT_UUID_XPATH
            )
            # If the submission has been edited before, it will already contain
            # a deprecatedID element - otherwise create a new element
            deprecated_id = get_or_create_element(
                xml_parsed, self.SUBMISSION_DEPRECATED_UUID_XPATH
            )
            deprecated_id.text = instance_id.text
            instance_id.text = uuid_formatted

            # If the form has been updated with new fields and earlier
            # submissions have been selected as part of the bulk update,
            # a new element has to be created before a value can be set.
            # However, with this new power, arbitrary fields can be added
            # to the XML tree through the API.
            for path, value in update_data.items():
                edit_submission_xml(xml_parsed, path, value)

            request = kwargs.get('request')
            with http_open_rosa_error_handler(
                lambda: self.store_submission(
                    user,
                    xml_tostring(xml_parsed),
                    _uuid,
                    request=request,
                ),
                request,
            ) as handler:
                backend_results.append(
                    {
                        'uuid': _uuid,
                        'error': handler.error,
                        'result': handler.func_return,
                    }
                )
        return self.prepare_bulk_update_response(backend_results)

    @abc.abstractmethod
    def calculated_submission_count(self, user: settings.AUTH_USER_MODEL, **kwargs):
        pass

    @abc.abstractmethod
    def connect(self, active=False):
        pass

    def copy_submission_extras(self, origin_uuid: str, dest_uuid: str):
        """
        Copy the submission extras from an origin submission uuid
        to a destination uuid. Should be used along with duplicate_submission,
        after it succeeds at duplicating a submission
        """
        original_extras = self.asset.submission_extras.filter(
            submission_uuid=origin_uuid
        ).first()
        if original_extras is not None:
            duplicated_extras = copy.deepcopy(original_extras.content)
            duplicated_extras['submission'] = dest_uuid
            self.asset.update_submission_extra(duplicated_extras)

    def delete(self):
        self.asset._deployment_data.clear()  # noqa

    @abc.abstractmethod
    def delete_submission(
        self, submission_id: int, user: settings.AUTH_USER_MODEL
    ) -> dict:
        pass

    @abc.abstractmethod
    def delete_submissions(
        self, data: dict, user: settings.AUTH_USER_MODEL, **kwargs
    ) -> dict:
        pass

    @abc.abstractmethod
    def duplicate_submission(
        self,
        submission_id: int,
        request: 'rest_framework.request.Request',
    ) -> dict:
        pass

    @property
    @abc.abstractmethod
    def enketo_id(self):
        pass

    @property
    @abc.abstractmethod
    def form_uuid(self):
        pass

    @staticmethod
    def generate_new_instance_id() -> (str, str):
        """
        Returns:
            - Generated uuid
            - Formatted uuid for OpenRosa xml
        """
        _uuid = str(uuid.uuid4())
        return _uuid, f'uuid:{_uuid}'

    @abc.abstractmethod
    def get_attachment(
        self,
        submission_id_or_uuid: Union[int, str],
        user: 'settings.AUTH_USER_MODEL',
        attachment_id: Optional[int] = None,
        xpath: Optional[str] = None,
    ) -> tuple:
        pass

    def get_attachment_objects_from_dict(self, submission: dict) -> list:
        pass

    @abc.abstractmethod
    def get_daily_counts(self, user: settings.AUTH_USER_MODEL, timeframe: tuple[date, date]) -> dict:
        pass

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
    def get_data_download_links(self):
        pass

    @abc.abstractmethod
    def get_enketo_survey_links(self):
        pass

    def get_submission(
        self,
        submission_id: int,
        user: settings.AUTH_USER_MODEL,
        format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
        request: Optional['rest_framework.request.Request'] = None,
        **mongo_query_params: dict
    ) -> Union[dict, str, None]:
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
                user,
                format_type,
                [int(submission_id)],
                request,
                **mongo_query_params
            )
        )
        try:
            return submissions[0]
        except IndexError:
            pass
        return None

    @abc.abstractmethod
    def get_submissions(
        self,
        user: settings.AUTH_USER_MODEL,
        format_type: str = SUBMISSION_FORMAT_TYPE_JSON,
        submission_ids: list = [],
        request: Optional['rest_framework.request.Request'] = None,
        **mongo_query_params
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
    def get_validation_status(self, submission_id: int, user: settings.AUTH_USER_MODEL) -> dict:
        """
        Return a formatted dict to be passed to a Response object
        """
        pass

    @property
    def last_submission_time(self):
        return self._last_submission_time()

    @property
    def mongo_userform_id(self):
        return None

    @abc.abstractmethod
    def nlp_tracking_data(self, start_date: Optional[datetime.date] = None):
        pass

    @abc.abstractmethod
    def prepare_bulk_update_response(self, backend_results: list[dict]) -> dict:
        pass

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

    @abc.abstractmethod
    def rename_enketo_id_key(self, previous_owner_username: str):
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

        self.store_data(updates)
        self.asset.set_deployment_status()

        # never save `_stored_data_key` attribute
        updates.pop('_stored_data_key', None)

        self.asset.__class__.objects.filter(id=self.asset.pk).update(
            _deployment_data=UpdateJSONFieldAttributes(
                '_deployment_data',
                updates=updates,
            ),
            date_modified=now,
            _deployment_status=self.asset.deployment_status
        )
        self.asset.date_modified = now

    @abc.abstractmethod
    def set_active(self, active: bool):
        pass

    @abc.abstractmethod
    def set_asset_uid(self, **kwargs) -> bool:
        pass

    @abc.abstractmethod
    def set_enketo_open_rosa_server(
        self, require_auth: bool, enketo_id: str = None
    ):
        pass

    def set_status(self, status):
        self.save_to_db({'status': status})

    @abc.abstractmethod
    def set_validation_status(
        self,
        submission_id: int,
        user: settings.AUTH_USER_MODEL,
        data: dict,
        method: str,
    ) -> dict:
        pass

    @abc.abstractmethod
    def set_validation_statuses(self, user: settings.AUTH_USER_MODEL, data: dict) -> dict:
        pass

    @property
    def status(self):
        return self.get_data('status')

    def store_data(self, values: dict):
        """ Saves in memory only; writes nothing to the database """
        values = copy.deepcopy(values)
        self.__stored_data_key = ShortUUID().random(24)
        values['_stored_data_key'] = self.__stored_data_key
        self.asset._deployment_data.update(values)  # noqa

    @property
    def stored_data_key(self):
        return self.__stored_data_key

    @abc.abstractmethod
    def store_submission(
        self, user, xml_submission, submission_uuid, attachments=None, **kwargs
    ):
        pass

    @property
    @abc.abstractmethod
    def submission_count(self):
        pass

    @property
    @abc.abstractmethod
    def submission_count_since_date(
        self, start_date: Optional[datetime.date] = None
    ):
        pass

    @property
    @abc.abstractmethod
    def submission_model(self):
        pass

    @staticmethod
    @abc.abstractmethod
    @contextmanager
    def suspend_submissions(user_ids: list[int]):
        pass

    @abc.abstractmethod
    def sync_media_files(self, file_type: str = AssetFile.FORM_MEDIA):
        pass

    @abc.abstractmethod
    def transfer_counters_ownership(self, new_owner: 'kobo_auth.User'):
        pass

    @abc.abstractmethod
    def transfer_submissions_ownership(
        self, previous_owner_username: str
    ) -> bool:
        pass

    def validate_submission_list_params(
        self,
        user: settings.AUTH_USER_MODEL,
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
                    'count': t(
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
                    'sort': t('This param is not supported in `XML` format')
                })

            if 'fields' in mongo_query_params:
                raise serializers.ValidationError({
                    'fields': t('This is not supported in `XML` format')
                })

        start = mongo_query_params.get('start', 0)
        limit = mongo_query_params.get('limit')
        sort = mongo_query_params.get('sort', {})
        fields = mongo_query_params.get('fields', [])
        query = mongo_query_params.get('query', {})
        submission_ids = mongo_query_params.get('submission_ids', [])
        skip_count = mongo_query_params.get('skip_count', False)

        # I've copied these `ValidationError` messages verbatim from DRF where
        # possible.TODO: Should this validation be in (or called directly by)
        # the view code? Does DRF have a validator for GET params?

        if isinstance(query, str):
            try:
                query = json.loads(query, object_hook=json_util.object_hook)
            except ValueError:
                raise serializers.ValidationError(
                    {'query': t('Value must be valid JSON.')}
                )

        if not isinstance(submission_ids, list):
            raise serializers.ValidationError(
                {'submission_ids': t('Value must be a list.')}
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
                    {'sort': t('Value must be valid JSON.')}
                )

        try:
            start = positive_int(start)
        except ValueError:
            raise serializers.ValidationError(
                {'start': t('A positive integer is required.')}
            )
        try:
            if limit is not None:
                limit = positive_int(limit, strict=True)
        except ValueError:
            raise serializers.ValidationError(
                {'limit': t('A positive integer is required.')}
            )

        if isinstance(fields, str):
            try:
                fields = json.loads(fields, object_hook=json_util.object_hook)
            except ValueError:
                raise serializers.ValidationError(
                    {'fields': t('Value must be valid JSON.')}
                )

        params = {
            'query': query,
            'start': start,
            'fields': fields,
            'sort': sort,
            'submission_ids': submission_ids,
            'permission_filters': permission_filters,
            'skip_count': skip_count,
        }

        if limit:
            params['limit'] = limit

        return params

    def validate_access_with_partial_perms(
        self,
        user: settings.AUTH_USER_MODEL,
        perm: str,
        submission_ids: list = [],
        query: dict = {},
    ) -> Optional[list]:
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
            # If no submission ids are provided, the back end must rebuild the
            # query to retrieve the related submissions. Unfortunately, the
            # current back end (KoBoCAT) does not support row level permissions.
            # Thus, we need to fetch all the submissions the user is allowed to
            # see in order to compare the requested subset of submissions to
            # all
            all_submissions = self.get_submissions(
                user=user,
                partial_perm=perm,
                fields=['_id'],
                skip_count=True,
            )
            allowed_submission_ids = [r['_id'] for r in all_submissions]

            # User should see at least one submission to be allowed to do
            # something
            if not allowed_submission_ids:
                raise PermissionDenied

            # If `query` is not provided, the action is performed on all
            # submissions. There is no need to go further.
            if not query:
                return allowed_submission_ids

        submissions = self.get_submissions(
            user=user,
            partial_perm=perm,
            fields=['_id'],
            submission_ids=submission_ids,
            query=query,
            skip_count=True,
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
            # Regardless of whether the request contained a query or a
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

    def _rewrite_json_attachment_urls(
        self, submission: dict, request
    ) -> dict:
        if not request or '_attachments' not in submission:
            return submission

        attachment_xpaths = self.asset.get_attachment_xpaths(deployed=True)
        filenames_and_xpaths = get_attachment_filenames_and_xpaths(
            submission, attachment_xpaths
        )

        for attachment in submission['_attachments']:
            # We should use 'attachment-list' with `?xpath=` but we do not
            # know what the XPath is here. Since the primary key is already
            # exposed, let's use it to build the url.
            kpi_url = reverse(
                'attachment-detail',
                args=(
                    self.asset.uid,
                    submission['_id'],
                    attachment['id'],
                ),
                request=request,
            )
            key = f'download_url'
            attachment[key] = kpi_url
            if attachment['mimetype'].startswith('image/'):
                for suffix in settings.THUMB_CONF.keys():
                    kpi_url = reverse(
                        'attachment-thumb',
                        args=(
                            self.asset.uid,
                            submission['_id'],
                            attachment['id'],
                            suffix,
                        ),
                        request=request,
                    )
                    key = f'download_{suffix}_url'
                    attachment[key] = kpi_url
            else:
                for suffix in settings.THUMB_CONF.keys():
                    try:
                        key = f'download_{suffix}_url'
                        del attachment[key]
                    except KeyError:
                        continue

            filename = attachment['filename']
            attachment['filename'] = os.path.join(
                self.asset.owner.username,
                'attachments',
                # KoboCAT accepts submissions even when they lack `formhub/uuid`
                self.form_uuid or submission['formhub/uuid'],
                submission['_uuid'],
                os.path.basename(filename)
            )

            # Retrieve XPath and add it to attachment dictionary
            basename = os.path.basename(attachment['filename'])
            attachment['question_xpath'] = filenames_and_xpaths.get(basename, '')

        return submission
