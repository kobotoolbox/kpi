#!/usr/bin/python
# -*- coding: utf-8 -*-


class BaseDeploymentBackend:
    def __init__(self, asset):
        self.asset = asset
    def store_data(self, vals={}):
        self.asset.deployment_data.update(vals)
        # should we automatically save?
        self.asset.save()
