#!/usr/bin/python
# -*- coding: utf-8 -*-

import json

from bson import json_util, ObjectId
from django.utils.translation import ugettext_lazy as _
from rest_framework import exceptions


class BaseDeploymentBackend(object):

    # TODO. Stop using protected property `_deployment_data`.

    def __init__(self, asset):
        self.asset = asset

    def store_data(self, vals=None):
        self.asset._deployment_data.update(vals)

    def delete(self):
        self.asset._deployment_data.clear()

    @classmethod
    def validate_submission_list_params(cls, **kwargs):
        """
        Ensure types of query and each param

        :param query: dict
        :param kwargs: dict
        :return: dict
        """

        start = kwargs.get('start', 0)
        limit = kwargs.get('limit')
        sort = kwargs.get('sort', {})
        fields = kwargs.get('fields', [])
        query = kwargs.get('query', {})
        instance_ids = kwargs.get('instance_ids', [])
        permission_filters = kwargs.get('permission_filters')

        # I've copied these `ValidationError` messages verbatim from DRF where
        # possible. TODO: Should this validation be in (or called directly by)
        # the view code? Does DRF have a validator for GET params?

        if isinstance(query, basestring):
            try:
                query = json.loads(query, object_hook=json_util.object_hook)
            except ValueError:
                raise exceptions.ValidationError(
                    {'query': _('Value must be valid JSON.')}
                )

        if isinstance(sort, basestring):
            try:
                sort = json.loads(sort, object_hook=json_util.object_hook)
            except ValueError:
                raise exceptions.ValidationError(
                    {'sort': _('Value must be valid JSON.')}
                )

        try:
            start = int(start)
            if start < 0:
                raise ValueError
        except ValueError:
            raise exceptions.ValidationError(
                {'start': _('A positive integer is required.')}
            )
        try:
            if limit is not None:
                limit = int(limit)
                if limit < 0:
                    raise ValueError
        except ValueError:
            raise exceptions.ValidationError(
                {'limit': _('A positive integer is required.')}
            )

        if isinstance(fields, basestring):
            try:
                fields = json.loads(fields, object_hook=json_util.object_hook)
            except ValueError:
                raise exceptions.ValidationError(
                    {'fields': _('Value must be valid JSON.')}
                )

        if not isinstance(instance_ids, list):
            raise exceptions.ValidationError(
                {'instance_ids': _('Value must be a list.')}
            )

        if not (isinstance(permission_filters, list) or permission_filters is None):
            # This error should not be returned as `ValidationError` to user.
            # We want to return a 500.
            raise ValueError(_('Invalid `permission_filters` param'))

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

    def calculated_submission_count(self, **kwargs):
        params = self.validate_submission_list_params(**kwargs)
        # Remove useless property for count
        params.pop('fields', None)
        params.pop('start', None)
        params.pop('start', None)
        params.pop('sort', None)
        return self._calculated_submission_count(**params)

    @property
    def backend(self):
        return self.asset._deployment_data.get('backend', None)

    @property
    def identifier(self):
        return self.asset._deployment_data.get('identifier', None)

    @property
    def active(self):
        return self.asset._deployment_data.get('active', False)

    @property
    def version(self):
        raise NotImplementedError('Use `asset.deployment.version_id`')

    @property
    def version_id(self):
        return self.asset._deployment_data.get('version', None)

    @property
    def submission_count(self):
        return self._submission_count()

    @property
    def last_submission_time(self):
        return self._last_submission_time()

    @property
    def mongo_userform_id(self):
        return None

