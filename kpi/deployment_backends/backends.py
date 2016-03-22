#!/usr/bin/python
# -*- coding: utf-8 -*-

from mock_backend import MockDeploymentBackend

DEPLOYMENT_BACKENDS = {
    'mock': MockDeploymentBackend,
}


class UninitializedDeploymentBackend:
    '''
    this class is only in place to facilitate connection to deployable backends
    '''
    def __init__(self, asset):
        self.asset = asset

    def __getattr__(self, attr):
        '''
        this is in place to prevent UninitializedDeploymentBackend from being
        treated as a connected / deployed backend.
        '''
        if attr not in [
            'connect',
            ]:
            raise Exception('UninitializedDeploymentBackend can only call '
                            '"connect". Attempted: {}'.format(attr))

    def connect(self, **kwargs):
        _type = kwargs['type']
        if _type in DEPLOYMENT_BACKENDS:
            DEPLOYMENT_BACKENDS[_type](self.asset).connect()
        else:
            raise KeyError('cannot create a deployment of type: "{}"'.format(_type))
