#!/usr/bin/python
# -*- coding: utf-8 -*-

from base_backend import BaseDeploymentBackend


class MockDeploymentBackend(BaseDeploymentBackend):
    '''
    only used for unit testing and interface testing.

    defines the interface for a deployment backend. 
    '''
    def connect(self):
        self.store_data({
                'backend': 'mock',
                'identifier': 'mock://%s' % self.asset.uid,
                'active': False,
            })

    def set_active(self, active):
        self.store_data({
                'active': bool(active),
            })
