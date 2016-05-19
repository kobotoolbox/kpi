#!/usr/bin/python
# -*- coding: utf-8 -*-

from base_backend import BaseDeploymentBackend


class MockDeploymentBackend(BaseDeploymentBackend):
    '''
    only used for unit testing and interface testing.

    defines the interface for a deployment backend.
    '''
    def connect(self, identifier=None, active=False):
        if not identifier:
            identifier = '/assets/%s/deployment/' % self.asset.uid
        self.store_data({
                'backend': 'mock',
                'identifier': identifier,
                'active': active,
            })

    def set_active(self, active):
        self.store_data({
                'active': bool(active),
            })

    def get_enketo_survey_links(self):
        # `self` is a demo Enketo form, but there's no guarantee it'll be
        # around forever.
        return {
            'url': 'https://enke.to/::self',
            'iframe_url': 'https://enke.to/i/::self',
            'offline_url': 'https://enke.to/_/#self',
            'preview_url': 'https://enke.to/preview/::self',
            'preview_iframe_url': 'https://enke.to/preview/i/::self',
        }
