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
        if not self.has_deployment:
            self.connect_deployment(backend=backend, active=active)
        else:
            self.deployment.redeploy(active=active)
        self._deployed = True

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
