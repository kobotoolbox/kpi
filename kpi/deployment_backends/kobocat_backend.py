#!/usr/bin/python
# -*- coding: utf-8 -*-

from base_backend import BaseDeploymentBackend


class KobocatDeploymentBackend(BaseDeploymentBackend):
    '''
    Used to deploy a project into KC. Stores the project identifiers in the
    "self.asset.deployment_data" JSONField.
    '''
    def connect(self, server):
        '''
        POST initial survey content to kobocat and create a new project.
        store results in self.asset.deployment_data.
        '''
        self.asset.deployment_data.update({
                'type': 'kobocat',
                'identifier': '{server}/{username}/forms/{id_string}'.format(
                    server=server,
                    username=self.asset.owner.username,
                    id_string=self.asset.uid,
                    ),
                'active': False,
            })
        self.asset.save()

    def set_active(self, active):
        '''
        PATCH active boolean of survey.
        store results in self.asset.deployment_data
        '''
        # self.store_data is an alias for
        # self.asset.deployment_data.update(...)
        # self.asset.save()
        self.store_data({
                'active': bool(active),
            })
