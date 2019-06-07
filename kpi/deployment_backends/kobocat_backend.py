#!/usr/bin/python
# -*- coding: utf-8 -*-
from __future__ import absolute_import

import cStringIO
import json
import re
import requests
import unicodecsv
import urlparse
import posixpath

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
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
from kpi.utils.mongo_helper import MongoDecodingHelper
from kpi.utils.log import logging


class KobocatDeploymentBackend(BaseDeploymentBackend):
    '''
    Used to deploy a project into KC. Stores the project identifiers in the
    "self.asset._deployment_data" JSONField.
    '''

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

        # Get or create the API authorization token for the asset's owner
        (token, is_new) = Token.objects.get_or_create(user=self.asset.owner)
        headers = kwargs.pop('headers', {})
        headers[u'Authorization'] = 'Token ' + token.key

        # Make the request to KC
        try:
            response = requests.request(
                method, url, headers=headers, **kwargs)
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

    def get_submission_edit_url(self, submission_pk):
        url = '{detail_url}/enketo'.format(
            detail_url=self.get_submission_detail_url(submission_pk)
        )
        return url

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

    def get_submissions(self, format_type=INSTANCE_FORMAT_TYPE_JSON, instances_ids=[]):
        """
        Retreives submissions through Postgres or Mongo depending on `format_type`.
        It can be filtered on instances uuids.
        `uuid` is used instead of `id` because `id` is not available in ReadOnlyInstance model

        :param format_type: str. INSTANCE_FORMAT_TYPE_JSON|INSTANCE_FORMAT_TYPE_XML
        :param instances_ids: list. Optional
        :return: list: mixed
        """
        submissions = []
        if format_type == INSTANCE_FORMAT_TYPE_JSON:
            submissions = self.__get_submissions_in_json(instances_ids)
        elif format_type == INSTANCE_FORMAT_TYPE_XML:
            submissions = self.__get_submissions_in_xml(instances_ids)
        else:
            raise BadFormatException(
                "The format {} is not supported".format(format_type)
            )
        return submissions

    def get_submission(self, pk, format_type=INSTANCE_FORMAT_TYPE_JSON):
        """
        Returns only one occurrence.

        :param pk: int. `Instance.id`
        :param format_type: str.  INSTANCE_FORMAT_TYPE_JSON|INSTANCE_FORMAT_TYPE_XML
        :return: mixed. JSON or XML
        """

        if pk:
            submissions = list(self.get_submissions(format_type, [pk]))
            if len(submissions) > 0:
                return submissions[0]
            return None
        else:
            raise ValueError("Primary key must be provided")

    def __get_submissions_in_json(self, instances_ids=[]):
        """
        Retrieves instances directly from Mongo.

        :param instances_ids: list. Optional
        :return: generator<JSON>
        """
        query = {
            "_userform_id": self.mongo_userform_id,
            "_deleted_at": {"$exists": False}
        }

        if len(instances_ids) > 0:
            query.update({
                "_id": {"$in": instances_ids}
            })

        instances = settings.MONGO_DB.instances.find(query)
        return (
            MongoDecodingHelper.to_readable_dict(instance)
            for instance in instances
        )

    def __get_submissions_in_xml(self, instances_ids=[]):
        """
        Retrieves instances directly from Postgres.

        :param instances_ids: list. Optional
        :return: list<XML>
        """
        queryset = ReadOnlyInstance.objects.filter(
            xform_id=self.xform_id,
            deleted_at=None
        )

        if len(instances_ids) > 0:
            queryset = queryset.filter(id__in=instances_ids)

        queryset = queryset.order_by("id")

        return (lazy_instance.xml for lazy_instance in queryset)
