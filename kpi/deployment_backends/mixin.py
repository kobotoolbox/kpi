# -*- coding: utf-8 -*-
from __future__ import absolute_import
import json

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.translation import ugettext_lazy as _
import requests
from requests.utils import quote
from rest_framework import serializers
from rest_framework.authtoken.models import Token
from rest_framework.decorators import detail_route, list_route

from .backends import DEPLOYMENT_BACKENDS
from .kobocat_backend import KobocatDeploymentBackend
from .mock_backend import MockDeploymentBackend
from kpi.exceptions import BadAssetTypeException
from kpi.constants import ASSET_TYPE_SURVEY


class DeployableMixin:
    def connect_deployment(self, **kwargs):
        if 'backend' in kwargs:
            backend = kwargs.pop('backend')
            try:
                DEPLOYMENT_BACKENDS[backend](self).connect(**kwargs)
            except KeyError as e:
                raise KeyError(
                    'cannot retrieve asset backend: "{}"'.format(backend))
        else:
            raise KeyError('connect_deployment requires an argument: backend')

    def deploy(self, backend=False, active=True):
        """this method could be called "deploy_latest_version()"."""

        if self.can_be_deployed:
            if not self.has_deployment:
                self.connect_deployment(backend=backend, active=active)
            else:
                self.deployment.redeploy(active=active)
            self._mark_latest_version_as_deployed()
        else:
            raise BadAssetTypeException("Only surveys may be deployed, but this asset is a {}".format(
                self.asset_type))

    def _mark_latest_version_as_deployed(self):
        """ `sync_kobocat_xforms` calls this, since it manipulates
        `_deployment_data` directly. Everything else should probably call
        `deploy()` above """
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
        except KeyError as e:
            raise KeyError('cannot retrieve asset backend: {}'.format(backend))

    @property
    def can_be_deployed(self):
        return self.asset_type and self.asset_type == ASSET_TYPE_SURVEY
