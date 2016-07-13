#!/usr/bin/python
# -*- coding: utf-8 -*-


class BaseDeploymentBackend:
    def __init__(self, asset):
        self.asset = asset

    def store_data(self, vals={}):
        self.asset._deployment_data.update(vals)
        # should we automatically save?
        self.asset.save()

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
        return self.asset._deployment_data.get('version', None)

    @property
    def mongo_userform_id(self):
        return None
