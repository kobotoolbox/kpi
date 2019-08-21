# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)


class BaseDeploymentBackend(object):

    # TODO. Stop using protected property `_deployment_data`.

    def __init__(self, asset):
        self.asset = asset
        self.current_submissions_count = 0

    def store_data(self, vals=None):
        self.asset._deployment_data.update(vals)

    def delete(self):
        self.asset._deployment_data.clear()

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
