#!/usr/bin/python
# -*- coding: utf-8 -*-
import re

from base_backend import BaseDeploymentBackend
from kpi.constants import INSTANCE_FORMAT_TYPE_JSON, INSTANCE_FORMAT_TYPE_XML
from kpi.exceptions import BadFormatException


class MockDeploymentBackend(BaseDeploymentBackend):
    '''
    only used for unit testing and interface testing.

    defines the interface for a deployment backend.

    # TODO. Stop using protected property `_deployment_data`.
    '''
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

    def get_submissions(self, format_type=INSTANCE_FORMAT_TYPE_JSON, instances_ids=[]):
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
                submissions = [submission for submission in submissions if submission.get("id") in instances_ids]

        return submissions

    def get_submission(self, pk, format_type=INSTANCE_FORMAT_TYPE_JSON):
        if pk:
            submissions = list(self.get_submissions(format_type, [pk]))
            if len(submissions) > 0:
                return submissions[0]
            return None
        else:
            raise ValueError("Primary key must be provided")

    def set_has_kpi_hooks(self):
        """
        Store results in self.asset._deployment_data
        """
        has_active_hooks = self.asset.has_active_hooks
        self.store_data({
            "has_kpi_hooks": has_active_hooks,
        })
