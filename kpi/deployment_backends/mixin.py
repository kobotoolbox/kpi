#!/usr/bin/python
# -*- coding: utf-8 -*-

from backends import DEPLOYMENT_BACKENDS


class DeployableMixin:
    def connect_deployment(self, **kwargs):
        if 'type' in kwargs:
            _type = kwargs.pop('type')
            try:
                DEPLOYMENT_BACKENDS[_type](self).connect(**kwargs)
            except KeyError, e:
                raise KeyError('cannot retrieve asset backend: "{}"'.format(_type))
        else:
            raise KeyError('connect_deployment requires an argument "type"')

    @property
    def deployment(self):
        if 'type' not in self.deployment_data:
            raise Exception('must call asset.connect_deployment first')
        try:
            _type = self.deployment_data['type']
            return DEPLOYMENT_BACKENDS[_type](self)
        except KeyError, e:
            raise KeyError('cannot retrieve asset backend: {}'.format(_type))
