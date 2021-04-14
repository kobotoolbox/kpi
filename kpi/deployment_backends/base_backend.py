# coding: utf-8
import copy
import json
from typing import Union, Iterator

from bson import json_util
from django.db.models.query import QuerySet
from django.db import transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from django.core.exceptions import PermissionDenied
from rest_framework import serializers
from rest_framework.pagination import _positive_int as positive_int

from kpi.constants import (
    INSTANCE_FORMAT_TYPE_XML,
    INSTANCE_FORMAT_TYPE_JSON,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.exceptions import AbstractMethodError
from kpi.models.asset_file import AssetFile
from kpi.models.paired_data import PairedData
from kpi.utils.jsonbfield_helper import ReplaceValues


class BaseDeploymentBackend:
    INSTANCE_ID_FIELDNAME = '_id'
    STATUS_SYNCED = 'synced'
    STATUS_NOT_SYNCED = 'not-synced'

    def __init__(self, asset):
        self.asset = asset
        # Python-only attribute used by `kpi.views.v2.data.DataViewSet.list()`
        self.current_submissions_count = 0

    @property
    def active(self):
        return self.get_data('active', False)

    def connect(self, active=False):
        raise AbstractMethodError

    @property
    def backend(self):
        return self.get_data('backend', None)

    @property
    def backend_response(self):
        return self.get_data('backend_response', {})

    def bulk_assign_mapped_perms(self):
        raise AbstractMethodError

    def bulk_update_submissions(self):
        raise AbstractMethodError

    def calculated_submission_count(self, user: 'auth.User', **kwargs):
        raise AbstractMethodError

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
            return copy.deepcopy(self.asset._deployment_data)  # noqa

        value = None
        nested_path = dotted_path.split('.')
        nested_dict = self.asset._deployment_data  # noqa
        for key in nested_path:
            try:
                value = nested_dict[key]
            except KeyError:
                value = None
                break

            nested_dict = value

        return value if value else default

    def delete_submission(self, pk: int, user: 'auth.User') -> dict:
        raise AbstractMethodError

    def duplicate_submission(
            self, user: 'auth.User', instance_id: int, **kwargs: dict
    ) -> dict:
        raise AbstractMethodError

    def get_data_download_links(self):
        raise AbstractMethodError

    def get_enketo_survey_links(self):
        raise AbstractMethodError

    def get_submission(self,
                       pk: int,
                       user: 'auth.User',
                       format_type: str = INSTANCE_FORMAT_TYPE_JSON,
                       **kwargs: dict) -> Union[dict, str, None]:
        """
        Returns the corresponding submission whose id equals `pk` and which
        `user` is allowed to access.
        Otherwise, it returns `None`.
        The format `format_type` can be either:
        - 'json' (See `kpi.constants.INSTANCE_FORMAT_TYPE_JSON)
        - 'xml' (See `kpi.constants.INSTANCE_FORMAT_TYPE_XML)

        MongoDB filters can be passed through `kwargs` to narrow down the
        result.
        """

        submissions = list(self.get_submissions(user,
                                                format_type, [int(pk)],
                                                **kwargs))
        try:
            return submissions[0]
        except IndexError:
            pass
        return None

    def get_submission_detail_url(self, submission_pk):
        raise AbstractMethodError

    def get_submission_edit_url(self, submission_pk, user, params=None):
        raise AbstractMethodError

    def get_submission_validation_status_url(self, submission_pk):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = '{detail_url}validation_status/'.format(
            detail_url=self.get_submission_detail_url(submission_pk)
        )
        return url

    def get_submissions(self,
                        user: 'auth.User',
                        format_type: str = INSTANCE_FORMAT_TYPE_JSON,
                        instance_ids: list = [],
                        **kwargs: dict) -> [Iterator[dict], Iterator[str]]:
        raise AbstractMethodError

    def get_validation_status(self, submission_pk, params, user):
        submission = self.get_submission(
            submission_pk,
            user=user,
            format_type=INSTANCE_FORMAT_TYPE_JSON,
        )
        return {
            "data": submission.get("_validation_status")
        }

    @property
    def identifier(self):
        return self.get_data('identifier', None)

    @property
    def last_submission_time(self):
        return self._last_submission_time()

    @property
    def mongo_userform_id(self):
        return None

    def redeploy(self, active=None):
        raise AbstractMethodError

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
        with transaction.atomic():
            self.asset.__class__.objects.select_for_update() \
                .filter(id=self.asset.pk).update(
                _deployment_data=ReplaceValues(
                    '_deployment_data',
                    updates=updates,
                ),
                date_modified=now,
            )
        self.store_data(updates)
        self.asset.date_modified = now

    def set_active(self, active):
        raise AbstractMethodError

    def set_asset_uid(self, **kwargs) -> bool:
        raise AbstractMethodError

    def set_has_kpi_hooks(self):
        raise AbstractMethodError

    def set_status(self, status):
        self.save_to_db({'status': status})

    def set_validation_status(self,
                              submission_pk: int,
                              data: dict,
                              user: 'auth.User',
                              method: str) -> dict:
        raise AbstractMethodError

    def set_validation_statuses(self, data: dict, user: 'auth.User') -> dict:
        raise AbstractMethodError

    @property
    def status(self):
        return self.get_data('status')

    def store_data(self, vals=None):
        self.asset._deployment_data.update(vals)  # noqa

    @property
    def submission_count(self):
        return self._submission_count()

    @property
    def submission_list_url(self):
        raise AbstractMethodError

    def sync_media_files(self, file_type: str = AssetFile.FORM_MEDIA):
        raise AbstractMethodError

    def validate_submission_list_params(
        self,
        user: 'auth.User',
        format_type: str = INSTANCE_FORMAT_TYPE_JSON,
        validate_count: bool = False,
        **kwargs: dict
    ) -> dict:
        """
        Validates parameters (`kwargs`) to be passed to Mongo.
        parameters can be:
            - start
            - limit
            - sort
            - fields
            - query
            - instance_ids
        If `validate_count` is True,`start`, `limit`, `fields` and `sort` are
        ignored.

        If `user` has partial permissions, conditions are
        applied to the query to narrow down results to what they are allowed
        to see.
        """

        if 'count' in kwargs:
            raise serializers.ValidationError(
                {
                    'count': _(
                        'This param is not implemented. Use `count` property '
                        'of the response instead.'
                    )
                }
            )

        if validate_count is False and format_type == INSTANCE_FORMAT_TYPE_XML:
            if 'sort' in kwargs:
                # FIXME. Use Mongo to sort data and ask PostgreSQL to follow the order  # noqa
                # See. https://stackoverflow.com/a/867578
                raise serializers.ValidationError({
                    'sort': _('This param is not supported in `XML` format')
                })

            if 'fields' in kwargs:
                raise serializers.ValidationError({
                    'fields': _('This is not supported in `XML` format')
                })

        start = kwargs.get('start', 0)
        limit = kwargs.get('limit')
        sort = kwargs.get('sort', {})
        fields = kwargs.get('fields', [])
        query = kwargs.get('query', {})
        instance_ids = kwargs.get('instance_ids', [])

        # TODO: Should this validation be in (or called directly by) the view
        # code? Does DRF have a validator for GET params?

        if isinstance(query, str):
            try:
                query = json.loads(query, object_hook=json_util.object_hook)
            except ValueError:
                raise serializers.ValidationError(
                    {'query': _('Value must be valid JSON.')}
                )

        if not isinstance(instance_ids, list):
            raise serializers.ValidationError(
                {'instance_ids': _('Value must be a list.')}
            )

        # This error should not be returned as `ValidationError` to user.
        # We want to return a 500.
        try:
            partial_perm = kwargs.pop('partial_perm', PERM_VIEW_SUBMISSIONS)
            permission_filters = self.asset.get_filters_for_partial_perm(
                user.pk, perm=partial_perm)
        except ValueError:
            raise ValueError(_('Invalid `user_id` param'))

        if validate_count:
            return {
                'query': query,
                'instance_ids': instance_ids,
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
            'instance_ids': instance_ids,
            'permission_filters': permission_filters
        }

        if limit:
            params['limit'] = limit

        return params

    def validate_write_access_with_partial_perms(self,
                                                 user: 'auth.User',
                                                 perm: str,
                                                 instance_ids: list):
        """
        Validate whether `user` is allowed to perform write actions on
        submissions with the permission `perm`.
        It raises a `PermissionDenied` error if they cannot.

        No validation is made whether `user` is granted with other permissions
        than 'partial_submission' permission.
        """
        if PERM_PARTIAL_SUBMISSIONS not in self.get_perms(user):
            return

        results = self.get_submissions(
            user=user,
            format_type=INSTANCE_FORMAT_TYPE_JSON,
            partial_perm=perm,
            fields=[self.INSTANCE_ID_FIELDNAME],
            instance_ids=instance_ids,
        )
        allowed_instance_ids = [r[self.INSTANCE_ID_FIELDNAME] for r in results]

        if sorted(allowed_instance_ids) != sorted(instance_ids):
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
