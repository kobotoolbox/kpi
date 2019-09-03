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

        start = kwargs.get("start", 0)
        limit = kwargs.get("limit")
        sort = kwargs.get("sort", {})
        fields = kwargs.get("fields", [])
        query = kwargs.get("query", {})
        instances_ids = kwargs.get("instances_ids", [])

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

        if not isinstance(instances_ids, list):
            raise exceptions.ValidationError(
                {'instances_ids': _('Value must be a list.')}
            )

        params = {
            "query": query,
            "start": start,
            "fields": fields,
            "sort": sort,
            "instances_ids": instances_ids
        }
        if limit:
            params['limit'] = limit
        return params

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
