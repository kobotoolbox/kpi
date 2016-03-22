#!/usr/bin/python
# -*- coding: utf-8 -*-

from backends import UninitializedDeploymentBackend, DEPLOYMENT_BACKENDS


class ProjectDeployable:
    @property
    def deployment(self):
        if 'type' not in self.deployment_data:
            return UninitializedDeploymentBackend(self)
        try:
            _type = self.deployment_data['type']
            return DEPLOYMENT_BACKENDS[_type](self)
        except KeyError, e:
            raise KeyError('cannot retrieve asset backend: {}'.format(_type))
