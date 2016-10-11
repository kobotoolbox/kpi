#!/usr/bin/python
# -*- coding: utf-8 -*-

from backends import DEPLOYMENT_BACKENDS


class DeployableMixin:
    def connect_deployment(self, **kwargs):
        if 'backend' in kwargs:
            backend = kwargs.pop('backend')
            try:
                DEPLOYMENT_BACKENDS[backend](self).connect(**kwargs)
            except KeyError, e:
                raise KeyError(
                    'cannot retrieve asset backend: "{}"'.format(backend))
        else:
            raise KeyError('connect_deployment requires an argument: backend')

    def deploy(self, backend=False, active=True):
        '''this method could be called "deploy_latest_version()".'''
        if not self.has_deployment:
            self.connect_deployment(backend=backend, active=active)
        else:
            self.deployment.redeploy(active=active)
        self._mark_latest_version_as_deployed()

    def _mark_latest_version_as_deployed(self):
        ''' `sync_kobocat_xforms` calls this, since it manipulates
        `_deployment_data` directly. Everything else should probably call
        `deploy()` above '''
        latest_version = self.latest_version
        latest_version.deployed = True
        latest_version.save()

    @property
    def has_deployment(self):
        return 'backend' in self._deployment_data

    @property
    def deployment(self):
        if not self.has_deployment:
            raise Exception('must call asset.connect_deployment first')
        try:
            backend = self._deployment_data['backend']
            return DEPLOYMENT_BACKENDS[backend](self)
        except KeyError, e:
            raise KeyError('cannot retrieve asset backend: {}'.format(backend))
