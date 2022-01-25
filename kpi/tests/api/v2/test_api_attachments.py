# coding: utf-8
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
        self.someuser = User.objects.get(username="someuser")
        content_source_asset = Asset.objects.get(id=1)
        self.asset = Asset.objects.create(content=content_source_asset.content,
                                          owner=self.someuser,
                                          asset_type='survey')

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.__add_submissions()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = self.asset.deployment.submission_list_url
        self._deployment = self.asset.deployment

    def __add_submissions(self):
        letters = string.ascii_letters
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid
        # self.submissions_submitted_by_someuser = []

        submission = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.mp4',
            'q2': ''.join(random.choice(letters) for l in range(10)),
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'download_url': 'http://testserver/someuser/audio_conversion_test_clip.mp4',
                    'filename': 'someuser/audio_conversion_test_clip.mp4',
                    'mimetype': 'video/mp4',
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

    def test_get_mp4_without_conversion(self):
        # ToDo , ensure it's not converted if we don't specify `&format=mp3`
        pass

    def test_bad_xpath(self):
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
        assert response.data['detail'].code == 'xpath_not_found'
