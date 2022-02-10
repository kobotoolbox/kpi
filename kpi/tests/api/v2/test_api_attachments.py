# coding: utf-8
import json
import os
import random
import string
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.http import QueryDict
from django.urls import reverse
from rest_framework import status

from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AttachmentApiTests(BaseAssetTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:
        self.client.login(username='someuser', password='someuser')
        self.someuser = User.objects.get(username='someuser')
        content_source_asset = {
            'survey': [
                {'type': 'audio', 'label': 'q1', 'required': 'false', '$kuid': 'abcd'},
                {'type': 'file', 'label': 'q2', 'required': 'false', '$kuid': 'efgh'},
            ]
        }
        self.asset = Asset.objects.create(content=content_source_asset,
                                          owner=self.someuser,
                                          asset_type='survey')

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.__add_submissions()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = self.asset.deployment.submission_list_url
        self._deployment = self.asset.deployment

    def __add_submissions(self):
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid

        submission = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.mp4',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'id': 1,
                    'download_url': 'http://testserver/someuser/audio_conversion_test_clip.mp4',
                    'filename': 'someuser/audio_conversion_test_clip.mp4',
                    'mimetype': 'video/mp4',
                },
                {
                    'id': 2,
                    'download_url': 'http://testserver/someuser/audio_conversion_test_image.jpg',
                    'filename': 'someuser/audio_conversion_test_image.jpg',
                    'mimetype': 'image/jpeg',
                },
            ],
            '_submitted_by': 'someuser'
        }
        submissions.append(submission)
        self.asset.deployment.mock_submissions(submissions)
        self.submissions = submissions

    def test_convert_mp4_to_mp3(self):
        query_dict = QueryDict('', mutable=True)
        query_dict.update(
            {
                'xpath': 'q1',
                'format': 'mp3',
            }
        )
        url = '{baseurl}?{querystring}'.format(
            baseurl=reverse(
                self._get_endpoint('attachment-list'),
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'parent_lookup_data': 1,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'audio/mpeg'

    def test_reject_image_with_conversion(self):
        query_dict = QueryDict('', mutable=True)
        query_dict.update(
            {
                'xpath': 'q2',
                'format': 'mp3',
            }
        )
        url = '{baseurl}?{querystring}'.format(
            baseurl=reverse(
                self._get_endpoint('attachment-list'),
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'parent_lookup_data': 1,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response['Content-Type'] == 'application/json'
        assert response.data['detail'].code == 'not_supported_format'

    def test_get_mp4_without_conversion(self):
        query_dict = QueryDict('', mutable=True)
        query_dict.update(
            {
                'xpath': 'q1',
            }
        )
        url = '{baseurl}?{querystring}'.format(
            baseurl=reverse(
                self._get_endpoint('attachment-list'),
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'parent_lookup_data': 1,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'video/mp4'

    def test_get_attachment_with_id(self):
        url = reverse(
            self._get_endpoint('attachment-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'parent_lookup_data': 1,
                'pk': 1,
            },
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'video/mp4'

    def test_xpath_not_found(self):
        self.__add_submissions()
        query_dict = QueryDict('', mutable=True)
        query_dict.update(
            {
                'xpath': 'q0',
                'format': 'mp3',
            }
        )
        url = '{baseurl}?{querystring}'.format(
            baseurl=reverse(
                self._get_endpoint('attachment-list'),
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'parent_lookup_data': 1,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response['Content-Type'] == 'application/json'
        assert response.data['detail'].code == 'xpath_not_found'

    def test_invalid_xpath_syntax(self):
        self.__add_submissions()
        query_dict = QueryDict('', mutable=True)
        query_dict.update(
            {
                'xpath': 'q0@!',
                'format': 'mp3',
            }
        )
        url = '{baseurl}?{querystring}'.format(
            baseurl=reverse(
                self._get_endpoint('attachment-list'),
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'parent_lookup_data': 1,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'].code == 'invalid_xpath'
