#!/usr/bin/python
# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals
import re

from django.core.urlresolvers import reverse
from django.http import HttpResponse
from rest_framework import status

from .base_backend import BaseDeploymentBackend
from kpi.constants import INSTANCE_FORMAT_TYPE_JSON, INSTANCE_FORMAT_TYPE_XML


class MockDeploymentBackend(BaseDeploymentBackend):
    '''
    only used for unit testing and interface testing.

    defines the interface for a deployment backend.

    # TODO. Stop using protected property `_deployment_data`.
    '''

    INSTANCE_ID_FIELDNAME = "id"

    def connect(self, active=False):
        self.store_data({
                'backend': 'mock',
                'identifier': 'mock://%s' % self.asset.uid,
                'active': active,
            })

    def redeploy(self, active=None):
        '''
        Replace (overwrite) the deployment, keeping the same identifier, and
        optionally changing whether the deployment is active
        '''
        if active is None:
            active = self.active
        self.set_active(active)

    def set_active(self, active):
        self.store_data({
                'active': bool(active),
            })

    def get_enketo_survey_links(self):
        # `self` is a demo Enketo form, but there's no guarantee it'll be
        # around forever.
        return {
            'offline_url': 'https://enke.to/_/#self',
            'url': 'https://enke.to/::self',
            'iframe_url': 'https://enke.to/i/::self',
            'preview_url': 'https://enke.to/preview/::self',
            # 'preview_iframe_url': 'https://enke.to/preview/i/::self',
        }

    @property
    def submission_list_url(self):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        return reverse("submission-list", kwargs={"parent_lookup_asset": self.asset.uid})

    def get_submission_detail_url(self, submission_pk):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = '{list_url}{pk}/'.format(
            list_url=self.submission_list_url,
            pk=submission_pk
        )
        return url

    def get_submission_edit_url(self, submission_pk, user, params=None):
        """
        Gets edit URL of the submission in a format FE can understand

        :param submission_pk: int
        :param user: User
        :param params: dict
        :return: dict
        """

        return {
            "data": {
                "url": "http://server.mock/enketo/{}".format(submission_pk)
            }
        }

    def get_submission_validation_status_url(self, submission_pk):
        # This doesn't really need to be implemented.
        # We keep it to stay close to `KobocatDeploymentBackend`
        url = '{detail_url}validation_status/'.format(
            detail_url=self.get_submission_detail_url(submission_pk)
        )
        return url

    def delete_submission(self, pk, user):
        """
        Deletes submission
        :param pk: int
        :param user: User
        :return: JSON
        """
        # No need to delete data, just fake it
        return {
            "content_type": "application/json",
            "status": status.HTTP_204_NO_CONTENT,
        }

    def get_data_download_links(self):
        return {}

    def _submission_count(self):
        submissions = self.asset._deployment_data.get('submissions', [])
        return len(submissions)

    def _mock_submission(self, submission):
        """
        @TODO may be useless because of mock_submissions. Remove if it's not used anymore anywhere else.
        :param submission:
        """
        submissions = self.asset._deployment_data.get('submissions', [])
        submissions.append(submission)
        self.store_data({
            'submissions': submissions,
            })

    def mock_submissions(self, submissions):
        """
        Insert dummy submissions into `asset._deployment_data`
        :param submissions: list
        """
        self.store_data({"submissions": submissions})
        self.asset.save(create_version=False)

    def get_submissions(self, format_type=INSTANCE_FORMAT_TYPE_JSON, instances_ids=[], **kwargs):
        """
        Returns a list of json representation of instances.

        :param format_type: str. xml or json
        :param instances_ids: list. Ids of instances to retrieve
        :return: list
        """
        submissions = self.asset._deployment_data.get("submissions", [])

        if len(instances_ids) > 0:
            if format_type == INSTANCE_FORMAT_TYPE_XML:
                # ugly way to find matches, but it avoids to load each xml in memory.
                pattern = "|".join(instances_ids)
                submissions = [submission for submission in submissions
                               if re.search(r"<id>({})<\/id>".format(pattern), submission)]
            else:
                submissions = [submission for submission in submissions if submission.get("id") in
                               map(int, instances_ids)]

        params = self.validate_submission_list_params(**kwargs)
        # TODO: support other query parameters?
        if 'limit' in params:
            submissions = submissions[:params['limit']]

        return submissions

    def get_submission(self, pk, format_type=INSTANCE_FORMAT_TYPE_JSON, **kwargs):
        if pk:
            submissions = list(self.get_submissions(format_type, [pk], **kwargs))
            if len(submissions) > 0:
                return submissions[0]
            return None
        else:
            raise ValueError("Primary key must be provided")

    def get_validation_status(self, submission_pk, params, user):
        submission = self.get_submission(submission_pk, INSTANCE_FORMAT_TYPE_JSON)
        return {
            "data": submission.get("_validation_status")
        }

    def set_validation_status(self, submission_pk, data, user):
        pass

    def set_validation_statuses(self, data, user):
        pass

    def set_has_kpi_hooks(self):
        """
        Store results in self.asset._deployment_data
        """
        has_active_hooks = self.asset.has_active_hooks
        self.store_data({
            "has_kpi_hooks": has_active_hooks,
        })
