#!/usr/bin/python
# -*- coding: utf-8 -*-

import cStringIO
import logging
import re
import requests
import unicodecsv
import urlparse
import posixpath

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.translation import ugettext_lazy as _
from pyxform.xls2json_backends import xls_to_dict
from rest_framework import exceptions, status, serializers
from rest_framework.authtoken.models import Token
from rest_framework.decorators import detail_route

from base_backend import BaseDeploymentBackend
from .kc_access.utils import instance_count, last_submission_time


class KobocatDeploymentException(exceptions.APIException):
    def __init__(self, *args, **kwargs):
        if 'response' in kwargs:
            self.response = kwargs.pop('response')
        super(KobocatDeploymentException, self).__init__(*args, **kwargs)

    @property
    def invalid_form_id(self):
        # We recognize certain KC API responses as indications of an
        # invalid form id:
        invalid_form_id_responses = (
            'Form with this id or SMS-keyword already exists.',
            'In strict mode, the XForm ID must be a valid slug and '
                'contain no spaces.',
        )
        return self.detail in invalid_form_id_responses


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

    def to_csv_io(self, asset_xls_io, id_string):
        ''' Convert the output of `Asset.to_xls_io()` or
        `Asset.to_versioned_xls_io()` into a CSV appropriate for KC's
        `text_xls_form` '''
        xls_dict = xls_to_dict(asset_xls_io)
        csv_io = cStringIO.StringIO()
        writer = unicodecsv.writer(
            csv_io, delimiter=',', quotechar='"',
            quoting=unicodecsv.QUOTE_MINIMAL
        )
        settings_arr = xls_dict.get('settings', [])
        if len(settings_arr) == 0:
            settings_dict = {}
        else:
            settings_dict = settings_arr[0]
        if 'form_id' in settings_dict:
            del settings_dict['form_id']
        settings_dict['id_string'] = id_string
        settings_dict['form_title'] = self.asset.name
        xls_dict['settings'] = [settings_dict]

        for sheet_name, rows in xls_dict.items():
            if re.search(r'_header$', sheet_name):
                continue

            writer.writerow([sheet_name])
            out_keys = []
            out_rows = []
            for row in rows:
                out_row = []
                for key in row.keys():
                    if key not in out_keys:
                        out_keys.append(key)
                for out_key in out_keys:
                    out_row.append(row.get(out_key, None))
                out_rows.append(out_row)
            writer.writerow([None] + out_keys)
            for out_row in out_rows:
                writer.writerow([None] + out_row)
        return csv_io

    def _kobocat_request(self, method, url, data):
        ''' Make a POST or PATCH request and return parsed JSON '''

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
        headers = {u'Authorization':'Token ' + token.key}

        # Make the request to KC
        try:
            response = requests.request(
                method, url, headers=headers, data=data)
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
    def mongo_userform_id(self):
        try:
            backend_response = self.asset._deployment_data['backend_response']
            users = backend_response['users']
            owner = filter(lambda u: u['role'] == 'owner', users)[0]['user']
            return '{}_{}'.format(owner, self.xform_id_string)
        except KeyError:
            return None

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
        csv_io = self.to_csv_io(self.asset.to_xls_io(versioned=True), id_string)
        valid_xlsform_csv_repr = csv_io.getvalue()
        payload = {
            u'text_xls_form': valid_xlsform_csv_repr,
            u'downloadable': active
        }
        json_response = self._kobocat_request('POST', url, payload)
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
        csv_io = self.to_csv_io(self.asset.to_xls_io(versioned=True), id_string)
        valid_xlsform_csv_repr = csv_io.getvalue()
        payload = {
            u'text_xls_form': valid_xlsform_csv_repr,
            u'downloadable': active
        }
        try:
            json_response = self._kobocat_request('PATCH', url, payload)
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
        json_response = self._kobocat_request('PATCH', url, payload)
        assert(json_response['downloadable'] == bool(active))
        self.store_data({
            'active': json_response['downloadable'],
            'backend_response': json_response,
        })

    def delete(self):
        ''' WARNING! Deletes all submitted data! '''
        url = self.external_to_internal_url(self.backend_response['url'])
        try:
            self._kobocat_request('DELETE', url, None)
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
            'spss_labels': u'/'.join((forms_base_url, 'spss_labels.zip')),
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


class KobocatDataProxyViewSetMixin(object):
    '''
    List, retrieve, and delete submission data for a deployed asset via the
    KoBoCAT API.
    '''
    def _get_deployment(self, request):
        '''
        Presupposing the use of `NestedViewSetMixin`, return the deployment for
        the asset specified by the KPI request
        '''
        asset_uid = self.get_parents_query_dict()['asset']
        asset = get_object_or_404(self.parent_model, uid=asset_uid)
        if not asset.has_deployment:
            raise serializers.ValidationError(
                _('The specified asset has not been deployed'))
        if not isinstance(asset.deployment, KobocatDeploymentBackend):
            raise NotImplementedError(
                'This viewset can only be used with the KoBoCAT deployment '
                'backend')
        return asset.deployment

    @staticmethod
    def _kobocat_request(kpi_request, kc_request):
        '''
        Send `kc_request`, which must specify `method` and `url` at a minimum.
        If `kpi_request`, i.e. the incoming request to be proxied, is
        authenticated, logged-in user's API token will be added to
        `kc_request.headers`
        '''
        user = kpi_request.user
        if not user.is_anonymous() and user.pk != settings.ANONYMOUS_USER_ID:
            token, created = Token.objects.get_or_create(user=user)
            kc_request.headers['Authorization'] = 'Token %s' % token.key
        session = requests.Session()
        return session.send(kc_request.prepare())

    @staticmethod
    def _requests_response_to_django_response(requests_response):
        '''
        Convert a `requests.models.Response` into a `django.http.HttpResponse`
        '''
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
        deployment = self._get_deployment(kpi_request)
        if pk is None:
            kc_url = deployment.submission_list_url
        else:
            kc_url = deployment.get_submission_detail_url(pk)
        kc_request = requests.Request(
            method='GET',
            url=kc_url,
            params=kpi_request.GET
        )
        kc_response = self._kobocat_request(kpi_request, kc_request)
        return self._requests_response_to_django_response(kc_response)

    def delete(self, kpi_request, pk, *args, **kwargs):
        deployment = self._get_deployment(kpi_request)
        kc_url = deployment.get_submission_detail_url(pk)
        kc_request = requests.Request(method='DELETE', url=kc_url)
        kc_response = self._kobocat_request(kpi_request, kc_request)
        return self._requests_response_to_django_response(kc_response)

    @detail_route(methods=['get'])
    def edit(self, kpi_request, pk, *args, **kwargs):
        deployment = self._get_deployment(kpi_request)
        kc_url = deployment.get_submission_edit_url(pk)
        kc_request = requests.Request(
            method='GET',
            url=kc_url,
            params=kpi_request.GET
        )
        kc_response = self._kobocat_request(kpi_request, kc_request)
        return self._requests_response_to_django_response(kc_response)
