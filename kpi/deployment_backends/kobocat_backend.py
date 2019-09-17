#!/usr/bin/python
# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import cStringIO
import json
import re
import requests
import unicodecsv
import urlparse
import posixpath

from bson import json_util
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.utils.translation import ugettext_lazy as _
from pyxform.xls2json_backends import xls_to_dict
from rest_framework import exceptions, status, serializers
from rest_framework.request import Request
from rest_framework.authtoken.models import Token

from ..exceptions import BadFormatException, KobocatDeploymentException
from .base_backend import BaseDeploymentBackend
from .kc_access.utils import instance_count, last_submission_time
from .kc_access.shadow_models import ReadOnlyInstance, ReadOnlyXForm
from kpi.constants import INSTANCE_FORMAT_TYPE_JSON, INSTANCE_FORMAT_TYPE_XML
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.log import logging


class KobocatDeploymentBackend(BaseDeploymentBackend):
    """
    Used to deploy a project into KC. Stores the project identifiers in the
    "self.asset._deployment_data" JSONField.
    """

    INSTANCE_ID_FIELDNAME = "_id"

    @staticmethod
    def make_identifier(username, id_string):
        ''' Uses `settings.KOBOCAT_URL` to construct an identifier from a
        username and id string, without the caller having to specify a server
        or know the full format of KC identifiers '''
        # No need to use the internal URL here; it will be substituted in when
        # appropriate
        return u'{}/{}/forms/{}'.format(
            settings.KOBOCAT_URL,
            username,
            id_string
        )

    @staticmethod
    def external_to_internal_url(url):
        ''' Replace the value of `settings.KOBOCAT_URL` with that of
        `settings.KOBOCAT_INTERNAL_URL` when it appears at the beginning of
        `url` '''
        return re.sub(
            pattern=u'^{}'.format(re.escape(settings.KOBOCAT_URL)),
            repl=settings.KOBOCAT_INTERNAL_URL,
            string=url
        )

    @staticmethod
    def internal_to_external_url(url):
        ''' Replace the value of `settings.KOBOCAT_INTERNAL_URL` with that of
        `settings.KOBOCAT_URL` when it appears at the beginning of
        `url` '''
        return re.sub(
            pattern=u'^{}'.format(re.escape(settings.KOBOCAT_INTERNAL_URL)),
            repl=settings.KOBOCAT_URL,
            string=url
        )

    @property
    def backend_response(self):
        return self.asset._deployment_data['backend_response']

    def _kobocat_request(self, method, url, **kwargs):
        '''
        Make a POST or PATCH request and return parsed JSON. Keyword arguments,
        e.g. `data` and `files`, are passed through to `requests.request()`.
        '''

        expected_status_codes = {
            'POST': 201,
            'PATCH': 200,
            'DELETE': 204,
        }
        try:
            expected_status_code = expected_status_codes[method]
        except KeyError:
            raise NotImplementedError(
                u'This backend does not implement the {} method'.format(method)
            )

        # Make the request to KC
        try:
            kc_request = requests.Request(method=method, url=url, **kwargs)
            response = self.__kobocat_proxy_request(kc_request, user=self.asset.owner)

        except requests.exceptions.RequestException as e:
            # Failed to access the KC API
            # TODO: clarify that the user cannot correct this
            raise KobocatDeploymentException(detail=unicode(e))

        # If it's a no-content success, return immediately
        if response.status_code == expected_status_code == 204:
            return {}

        # Parse the response
        try:
            json_response = response.json()
        except ValueError as e:
            # Unparseable KC API output
            # TODO: clarify that the user cannot correct this
            raise KobocatDeploymentException(
                detail=unicode(e), response=response)

        # Check for failure
        if response.status_code != expected_status_code or (
            'type' in json_response and json_response['type'] == 'alert-error'
        ) or 'formid' not in json_response:
            if 'text' in json_response:
                # KC API refused us for a specified reason, likely invalid
                # input Raise a 400 error that includes the reason
                e = KobocatDeploymentException(detail=json_response['text'])
                e.status_code = status.HTTP_400_BAD_REQUEST
                raise e
            else:
                # Unspecified failure; raise 500
                raise KobocatDeploymentException(
                    detail='Unexpected KoBoCAT error {}: {}'.format(
                        response.status_code, response.content),
                    response=response
                )

        return json_response

    @property
    def timestamp(self):
        try:
            return self.backend_response['date_modified']
        except KeyError:
            return None

    @property
    def xform_id_string(self):
        return self.asset._deployment_data.get('backend_response', {}).get('id_string')

    @property
    def xform_id(self):
        pk = self.asset._deployment_data.get('backend_response', {}).get('formid')
        xform = ReadOnlyXForm.objects.filter(pk=pk).only(
            'user__username', 'id_string').first()
        if not (xform.user.username == self.asset.owner.username and
                xform.id_string == self.xform_id_string):
            raise Exception('Deployment links to an unexpected KoBoCAT XForm')
        return pk

    @property
    def mongo_userform_id(self):
        return '{}_{}'.format(self.asset.owner.username, self.xform_id_string)

    def connect(self, identifier=None, active=False):
        '''
        POST initial survey content to kobocat and create a new project.
        store results in self.asset._deployment_data.
        '''
        # If no identifier was provided, construct one using
        # `settings.KOBOCAT_URL` and the uid of the asset
        if not identifier:
            # Use the external URL here; the internal URL will be substituted
            # in when appropriate
            if not settings.KOBOCAT_URL or not settings.KOBOCAT_INTERNAL_URL:
                raise ImproperlyConfigured(
                    'Both KOBOCAT_URL and KOBOCAT_INTERNAL_URL must be '
                    'configured before using KobocatDeploymentBackend'
                )
            server = settings.KOBOCAT_URL
            username = self.asset.owner.username
            id_string = self.asset.uid
            identifier = '{server}/{username}/forms/{id_string}'.format(
                server=server,
                username=username,
                id_string=id_string,
            )
        else:
            # Parse the provided identifier, which is expected to follow the
            # format http://kobocat_server/username/forms/id_string
            parsed_identifier = urlparse.urlparse(identifier)
            server = u'{}://{}'.format(
                parsed_identifier.scheme, parsed_identifier.netloc)
            path_head, path_tail = posixpath.split(parsed_identifier.path)
            id_string = path_tail
            path_head, path_tail = posixpath.split(path_head)
            if path_tail != 'forms':
                raise Exception('The identifier is not properly formatted.')
            path_head, path_tail = posixpath.split(path_head)
            if path_tail != self.asset.owner.username:
                raise Exception(
                    'The username in the identifier does not match the owner '
                    'of this asset.'
                )
            if path_head != '/':
                raise Exception('The identifier is not properly formatted.')

        url = self.external_to_internal_url(u'{}/api/v1/forms'.format(server))
        xls_io = self.asset.to_xls_io(
            versioned=True, append={
                'settings': {
                    'id_string': id_string,
                    'form_title': self.asset.name,
                }
            }
        )
        payload = {
            u"downloadable": active,
            u"has_kpi_hook": self.asset.has_active_hooks
        }
        files = {'xls_file': (u'{}.xls'.format(id_string), xls_io)}
        json_response = self._kobocat_request(
            'POST', url, data=payload, files=files)
        self.store_data({
            'backend': 'kobocat',
            'identifier': self.internal_to_external_url(identifier),
            'active': json_response['downloadable'],
            'backend_response': json_response,
            'version': self.asset.version_id,
        })

    def redeploy(self, active=None):
        '''
        Replace (overwrite) the deployment, keeping the same identifier, and
        optionally changing whether the deployment is active
        '''
        if active is None:
            active = self.active
        url = self.external_to_internal_url(self.backend_response['url'])
        id_string = self.backend_response['id_string']
        xls_io = self.asset.to_xls_io(
            versioned=True, append={
                'settings': {
                    'id_string': id_string,
                    'form_title': self.asset.name,
                }
            }
        )
        payload = {
            u"downloadable": active,
            u"title": self.asset.name,
            u"has_kpi_hook": self.asset.has_active_hooks
        }
        files = {'xls_file': (u'{}.xls'.format(id_string), xls_io)}
        try:
            json_response = self._kobocat_request(
                'PATCH', url, data=payload, files=files)
            self.store_data({
                'active': json_response['downloadable'],
                'backend_response': json_response,
                'version': self.asset.version_id,
            })
        except KobocatDeploymentException as e:
            if hasattr(e, 'response') and e.response.status_code == 404:
                # Whoops, the KC project we thought we were going to overwrite
                # is gone! Try a standard deployment instead
                return self.connect(self.identifier, active)
            raise

    def set_active(self, active):
        '''
        PATCH active boolean of survey.
        store results in self.asset._deployment_data
        '''
        # self.store_data is an alias for
        # self.asset._deployment_data.update(...)
        url = self.external_to_internal_url(
            self.backend_response['url'])
        payload = {
            u'downloadable': bool(active)
        }
        json_response = self._kobocat_request('PATCH', url, data=payload)
        assert(json_response['downloadable'] == bool(active))
        self.store_data({
            'active': json_response['downloadable'],
            'backend_response': json_response,
        })

    def set_has_kpi_hooks(self):
        """
        PATCH `has_kpi_hooks` boolean of survey.
        It lets `kc` know whether it needs to ping `kpi`
        each time a submission comes in.

        Store results in self.asset._deployment_data
        """
        has_active_hooks = self.asset.has_active_hooks
        url = self.external_to_internal_url(
            self.backend_response["url"])
        payload = {
            u"has_kpi_hooks": has_active_hooks
        }
        json_response = self._kobocat_request("PATCH", url, data=payload)
        assert(json_response["has_kpi_hooks"] == has_active_hooks)
        self.store_data({
            "has_kpi_hooks": json_response.get("has_kpi_hooks"),
            "backend_response": json_response,
        })

    def delete(self):
        ''' WARNING! Deletes all submitted data! '''
        url = self.external_to_internal_url(self.backend_response['url'])
        try:
            self._kobocat_request('DELETE', url)
        except KobocatDeploymentException as e:
            if hasattr(e, 'response') and e.response.status_code == 404:
                # The KC project is already gone!
                pass
            else:
                raise
        super(KobocatDeploymentBackend, self).delete()

    def delete_submission(self, pk, user):
        """
        Deletes submission through `KoBoCat` proxy
        :param pk: int
        :param user: User
        :return: JSON
        """

        kc_url = self.get_submission_detail_url(pk)
        kc_request = requests.Request(method="DELETE", url=kc_url)
        kc_response = self.__kobocat_proxy_request(kc_request, user)

        return self.__prepare_as_drf_response_signature(kc_response)

    def get_enketo_survey_links(self):
        data = {
            'server_url': u'{}/{}'.format(
                settings.KOBOCAT_URL.rstrip('/'),
                self.asset.owner.username
            ),
            'form_id': self.backend_response['id_string']
        }
        try:
            response = requests.post(
                u'{}{}'.format(
                    settings.ENKETO_SERVER, settings.ENKETO_SURVEY_ENDPOINT),
                # bare tuple implies basic auth
                auth=(settings.ENKETO_API_TOKEN, ''),
                data=data
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            # Don't 500 the entire asset view if Enketo is unreachable
            logging.error(
                'Failed to retrieve links from Enketo', exc_info=True)
            return {}
        try:
            links = response.json()
        except ValueError:
            logging.error('Received invalid JSON from Enketo', exc_info=True)
            return {}
        for discard in ('enketo_id', 'code', 'preview_iframe_url'):
            try:
                del links[discard]
            except KeyError:
                pass
        return links

    def get_data_download_links(self):
        exports_base_url = u'/'.join((
            settings.KOBOCAT_URL.rstrip('/'),
            self.asset.owner.username,
            'exports',
            self.backend_response['id_string']
        ))
        reports_base_url = u'/'.join((
            settings.KOBOCAT_URL.rstrip('/'),
            self.asset.owner.username,
            'reports',
            self.backend_response['id_string']
        ))
        forms_base_url = u'/'.join((
            settings.KOBOCAT_URL.rstrip('/'),
            self.asset.owner.username,
            'forms',
            self.backend_response['id_string']
        ))
        links = {
            # To be displayed in iframes
            'xls_legacy': u'/'.join((exports_base_url, 'xls/')),
            'csv_legacy': u'/'.join((exports_base_url, 'csv/')),
            'zip_legacy': u'/'.join((exports_base_url, 'zip/')),
            'kml_legacy': u'/'.join((exports_base_url, 'kml/')),
            'analyser_legacy': u'/'.join((exports_base_url, 'analyser/')),
            # For GET requests that return files directly
            'xls': u'/'.join((reports_base_url, 'export.xlsx')),
            'csv': u'/'.join((reports_base_url, 'export.csv')),
        }
        return links

    def _submission_count(self):
        _deployment_data = self.asset._deployment_data
        id_string = _deployment_data['backend_response']['id_string']
        # avoid migrations from being created for kc_access mocked models
        # there should be a better way to do this, right?
        return instance_count(xform_id_string=id_string,
                              user_id=self.asset.owner.pk,
                              )

    @property
    def submission_list_url(self):
        url = '{kc_base}/api/v1/data/{formid}'.format(
            kc_base=settings.KOBOCAT_INTERNAL_URL,
            formid=self.backend_response['formid']
        )
        return url

    def get_submission_detail_url(self, submission_pk):
        url = '{list_url}/{pk}'.format(
            list_url=self.submission_list_url,
            pk=submission_pk
        )
        return url

    def get_submission_edit_url(self, submission_pk, user, params=None):
        """
        Gets edit URL of the submission from `kc` through proxy

        :param submission_pk: int
        :param user: User
        :param params: dict
        :return: JSON
        """
        url = '{detail_url}/enketo'.format(
            detail_url=self.get_submission_detail_url(submission_pk))
        kc_request = requests.Request(method='GET', url=url, params=params)
        kc_response = self.__kobocat_proxy_request(kc_request, user)

        return self.__prepare_as_drf_response_signature(kc_response)

    def _last_submission_time(self):
        _deployment_data = self.asset._deployment_data
        id_string = _deployment_data['backend_response']['id_string']
        return last_submission_time(
            xform_id_string=id_string, user_id=self.asset.owner.pk)

    def get_submission_validation_status_url(self, submission_pk):
        url = '{detail_url}/validation_status'.format(
            detail_url=self.get_submission_detail_url(submission_pk)
        )
        return url

    def get_submissions(self, format_type=INSTANCE_FORMAT_TYPE_JSON, instances_ids=[], **kwargs):
        """
        Retrieves submissions through Postgres or Mongo depending on `format_type`.
        It can be filtered on instances ids.

        :param format_type: str. INSTANCE_FORMAT_TYPE_JSON|INSTANCE_FORMAT_TYPE_XML
        :param instances_ids: list. Ids of instances to retrieve
        :param kwargs: dict. Filter parameters for Mongo query. See
            https://docs.mongodb.com/manual/reference/operator/query/
        :return: list: mixed
        """
        submissions = []

        if format_type == INSTANCE_FORMAT_TYPE_JSON:
            submissions = self.__get_submissions_in_json(instances_ids, **kwargs)
        elif format_type == INSTANCE_FORMAT_TYPE_XML:
            submissions = self.__get_submissions_in_xml(instances_ids, **kwargs)
        else:
            raise BadFormatException(
                "The format {} is not supported".format(format_type)
            )
        return submissions

    def get_submission(self, pk, format_type=INSTANCE_FORMAT_TYPE_JSON, **kwargs):
        """
        Returns only one occurrence.

        :param pk: int. `Instance.id`
        :param format_type: str.  INSTANCE_FORMAT_TYPE_JSON|INSTANCE_FORMAT_TYPE_XML
        :param kwargs: dict. Filter params
        :return: mixed. JSON or XML
        """

        if pk:
            submissions = list(self.get_submissions(format_type, [int(pk)], **kwargs))
            if len(submissions) > 0:
                return submissions[0]
            return None
        else:
            raise ValueError(_("Primary key must be provided"))

    def get_validation_status(self, submission_pk, params, user):
        url = self.get_submission_validation_status_url(submission_pk)
        kc_request = requests.Request(method="GET", url=url, data=params)
        kc_response = self.__kobocat_proxy_request(kc_request, user)
        return self.__prepare_as_drf_response_signature(kc_response)

    def set_validation_status(self, submission_pk, data, user):
        url = self.get_submission_validation_status_url(submission_pk)
        kc_request = requests.Request(method="PATCH", url=url, json=data)
        kc_response = self.__kobocat_proxy_request(kc_request, user)
        return self.__prepare_as_drf_response_signature(kc_response)

    def set_validation_statuses(self, data, user):
        url = self.submission_list_url
        kc_request = requests.Request(method="PATCH", url=url, json=data)
        kc_response = self.__kobocat_proxy_request(kc_request, user)
        return self.__prepare_as_drf_response_signature(kc_response)

    def __get_submissions_in_json(self, instances_ids=[], **kwargs):
        """
        Retrieves instances directly from Mongo.

        :param instances_ids: list. Optional
        :param kwargs: dict. Filter params
        :return: generator<JSON>
        """

        kwargs["instances_ids"] = instances_ids
        params = self.validate_submission_list_params(**kwargs)
        instances = MongoHelper.get_instances(self.mongo_userform_id, **params)

        return (
            MongoHelper.to_readable_dict(instance)
            for instance in instances
        )

    def __get_submissions_in_xml(self, instances_ids=[], **kwargs):
        """
        Retrieves instances directly from Postgres.

        :param instances_ids: list. Optional
        :param kwargs: dict. Filter params
        :return: list<XML>
        """

        sort = {"id": 1}
        kwargs["instances_ids"] = instances_ids
        use_mongo = False

        if "fields" in kwargs:
            raise ValueError(_("`Fields` param is not supported with XML format"))

        # Because `kwargs`' values are for `Mongo`'s query engine
        # We still use MongoHelper to validate params.
        params = self.validate_submission_list_params(**kwargs)

        if "query" in kwargs:
            # We use Mongo to retrieve matching instances.
            # Get only their ids and pass them to PostgreSQL.
            params["fields"] = ["_id"]
            instances_ids = [instance.get("_id") for instance in
                             MongoHelper.get_instances(self.mongo_userform_id, **params)]
            use_mongo = True

        queryset = ReadOnlyInstance.objects.filter(
            xform_id=self.xform_id,
            deleted_at=None
        )

        if len(instances_ids) > 0:
            queryset = queryset.filter(id__in=instances_ids)

        # Sort
        sort = params.get("sort") or sort
        sort_key = sort.keys()[0]
        sort_dir = int(sort[sort_key])  # -1 for desc, 1 for asc
        queryset = queryset.order_by("{direction}{field}".format(
            direction="-" if sort_dir < 0 else "",
            field=sort_key
        ))

        # When using Mongo, data is already paginated, no need to do it with PostgreSQL too.
        if not use_mongo:
            offset = params.get("start")
            limit = offset + params.get("limit")
            queryset = queryset[offset:limit]

        return (lazy_instance.xml for lazy_instance in queryset)

    @staticmethod
    def __kobocat_proxy_request(kc_request, user=None):
        """
        Send `kc_request`, which must specify `method` and `url` at a minimum.
        If the incoming request to be proxied is authenticated,
        logged-in user's API token will be added to `kc_request.headers`

        :param kc_request: requests.models.Request
        :param user: User
        :return: requests.models.Response
        """
        if not user.is_anonymous() and user.pk != settings.ANONYMOUS_USER_ID:
            token, created = Token.objects.get_or_create(user=user)
            kc_request.headers['Authorization'] = 'Token %s' % token.key
        session = requests.Session()
        return session.send(kc_request.prepare())

    @staticmethod
    def __prepare_as_drf_response_signature(requests_response):
        """
        Prepares a dict from `Requests` response.
        Useful to get response from `kc` and use it as a dict or pass it to
        DRF Response
        """

        prepared_drf_response = {}

        # `requests_response` may not have `headers` attribute
        content_type = requests_response.headers.get('Content-Type')
        content_language = requests_response.headers.get('Content-Language')
        if content_type:
            prepared_drf_response['content_type'] = content_type
        if content_language:
            prepared_drf_response['headers'] = {
                'Content-Language': content_language
            }

        prepared_drf_response['status'] = requests_response.status_code

        try:
            prepared_drf_response['data'] = json.loads(requests_response.content)
        except ValueError as e:
            if not requests_response.status_code == status.HTTP_204_NO_CONTENT:
                prepared_drf_response['data'] = {
                    'detail': _('KoBoCat returned an unexpected response: {}'.format(str(e)))
                }

        return prepared_drf_response

