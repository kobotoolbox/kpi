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
            except KeyError, e:
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


class MockDataProxyViewSetMixin(object):

    def retrieve(self, request, pk, *args, **kwargs):
        asset = self._get_asset(kwargs.get("asset"))
        if not asset.has_deployment:
            raise serializers.ValidationError(
                _('The specified asset has not been deployed'))
        elif pk is None:
            return HttpResponse(json.dumps(asset.deployment.get_submissions()),
                                content_type="application/json")
        else:
            data = (submission for submission in asset.deployment.get_submissions()
                    if submission.get("id") == pk).next()
            return HttpResponse(json.dumps(data), content_type="application/json")

    def _get_asset(self, asset):
        if asset is None:
            asset_uid = self.get_parents_query_dict()['asset']
            asset = get_object_or_404(self.parent_model, uid=asset_uid)

        return asset


class KobocatDataProxyViewSetMixin(MockDataProxyViewSetMixin):
    """
    List, retrieve, and delete submission data for a deployed asset via the
    KoBoCAT API.
    """
    def _get_deployment(self, request, asset=None):
        """
        Presupposing the use of `NestedViewSetMixin`, return the deployment for
        the asset specified by the KPI request
        """
        asset = self._get_asset(asset)

        if not asset.has_deployment:
            raise serializers.ValidationError(
                _('The specified asset has not been deployed'))
        if not isinstance(asset.deployment, KobocatDeploymentBackend):
            raise NotImplementedError(
                'This viewset can only be used with the KoBoCAT deployment '
                'backend')
        return asset.deployment

    @staticmethod
    def _kobocat_proxy_request(kpi_request, kc_request):
        """
        Send `kc_request`, which must specify `method` and `url` at a minimum.
        If `kpi_request`, i.e. the incoming request to be proxied, is
        authenticated, logged-in user's API token will be added to
        `kc_request.headers`
        """
        user = kpi_request.user
        if not user.is_anonymous() and user.pk != settings.ANONYMOUS_USER_ID:
            token, created = Token.objects.get_or_create(user=user)
            kc_request.headers['Authorization'] = 'Token %s' % token.key
        session = requests.Session()
        return session.send(kc_request.prepare())

    @staticmethod
    def _requests_response_to_django_response(requests_response):
        """
        Convert a `requests.models.Response` into a `django.http.HttpResponse`
        """
        HEADERS_TO_COPY = ('Content-Type', 'Content-Language')
        django_response = HttpResponse()
        for header in HEADERS_TO_COPY:
            try:
                django_response[header] = requests_response.headers[header]
            except KeyError:
                continue
        django_response.status_code = requests_response.status_code
        django_response.write(requests_response.content)
        return django_response

    def list(self, kpi_request, *args, **kwargs):
        return self.retrieve(kpi_request, None, *args, **kwargs)

    def retrieve(self, kpi_request, pk, *args, **kwargs):

        asset_uid = self.get_parents_query_dict()['asset']
        asset = get_object_or_404(self.parent_model, uid=asset_uid)

        if isinstance(asset.deployment, MockDeploymentBackend):
            return super(KobocatDataProxyViewSetMixin, self).retrieve(
                request=kpi_request,
                pk=pk,
                *args,
                **kwargs)
        else:
            deployment = self._get_deployment(kpi_request, asset=asset)
            if pk is None:
                kc_url = deployment.submission_list_url
            else:
                kc_url = deployment.get_submission_detail_url(pk)

            # We need to append query string parameters to url
            # if any.
            query_string_params = []
            for key, value in kwargs.items():
                if key.startswith("?"):
                    query_string_params.append("{}={}".format(
                        key[1:],
                        value
                    ))
                    kwargs.pop(key)
            if query_string_params:
                kc_url = "{}?{}".format(
                    kc_url,
                    "&".join(query_string_params)
                )

            # We can now retrieve XML or JSON format from `kc`
            # Request can be:
            # - /assets/<parent_lookup_asset>/submissions/<pk>/

            # - /assets/<parent_lookup_asset>/submissions/<pk>.<format>/
            #   where `format` is among `kwargs`

            # - /assets/<parent_lookup_asset>/submissions/<pk>?format=<format>/
            #   where `format` is among `request.GET`
            format = kwargs.pop("format", None)
            params = kpi_request.GET.copy()
            if format:
                params.update({"format": format})

            kc_request = requests.Request(
                method='GET',
                url=kc_url,
                params=params
            )
            kc_response = self._kobocat_proxy_request(kpi_request, kc_request)
            return self._requests_response_to_django_response(kc_response)

    def delete(self, kpi_request, pk, *args, **kwargs):
        deployment = self._get_deployment(kpi_request)
        kc_url = deployment.get_submission_detail_url(pk)
        kc_request = requests.Request(method='DELETE', url=kc_url)
        kc_response = self._kobocat_proxy_request(kpi_request, kc_request)
        return self._requests_response_to_django_response(kc_response)

    @detail_route(methods=['GET'])
    def edit(self, kpi_request, pk, *args, **kwargs):
        deployment = self._get_deployment(kpi_request)
        kc_url = deployment.get_submission_edit_url(pk)
        kc_request = requests.Request(
            method='GET',
            url=kc_url,
            params=kpi_request.GET
        )
        kc_response = self._kobocat_proxy_request(kpi_request, kc_request)
        return self._requests_response_to_django_response(kc_response)

    @detail_route(methods=["GET", "PATCH", "DELETE"])
    def validation_status(self, kpi_request, pk, *args, **kwargs):

        deployment = self._get_deployment(kpi_request)
        kc_url = deployment.get_submission_validation_status_url(pk)

        requests_params = {
            "method": kpi_request.method,
            "url": kc_url
        }

        # According to HTTP method,
        # params are passed to Request object in different ways.
        http_method_params = {}
        if kpi_request.method == "PATCH":
            http_method_params = {"json": kpi_request.data}
        elif kpi_request.method == "GET":
            http_method_params = {"params": kpi_request.GET}

        requests_params.update(http_method_params)

        kc_request = requests.Request(**requests_params)
        kc_response = self._kobocat_proxy_request(kpi_request, kc_request)

        return self._requests_response_to_django_response(kc_response)

    @list_route(methods=["PATCH", "DELETE"])
    def validation_statuses(self, kpi_request, *args, **kwargs):
        deployment = self._get_deployment(kpi_request)
        kc_url = deployment.submission_list_url
        data = kpi_request.data.copy()

        if kpi_request.method == "DELETE":
            data["reset"] = True

        requests_params = {
            "method": "PATCH",  # `PATCH` KC even if kpi receives `DELETE`
            "url": kc_url,
            "json": data
        }

        kc_request = requests.Request(**requests_params)
        kc_response = self._kobocat_proxy_request(kpi_request, kc_request)

        return self._requests_response_to_django_response(kc_response)
