import uuid
from unittest.mock import patch

from django.http import QueryDict
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.tests.utils.mock import guess_type_mock
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
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        self._deployment = self.asset.deployment
        self.submission_id = self.submissions[0]['_id']

    def __add_submissions(self):
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid

        _uuid = str(uuid.uuid4())
        submission = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.3gp',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': _uuid,
            'meta/instanceID': f'uuid:{_uuid}',
            '_attachments': [
                {
                    'download_url': 'http://testserver/someuser/audio_conversion_test_clip.3gp',
                    'filename': 'someuser/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
                },
                {
                    'download_url': 'http://testserver/someuser/audio_conversion_test_image.jpg',
                    'filename': 'someuser/audio_conversion_test_image.jpg',
                    'mimetype': 'image/jpeg',
                },
            ],
            '_submitted_by': 'someuser'
        }
        submissions.append(submission)

        with patch('mimetypes.guess_type') as guess_mock:
            guess_mock.side_effect = guess_type_mock
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
                    'parent_lookup_data': self.submission_id,
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
                    'parent_lookup_data': self.submission_id,
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
                    'parent_lookup_data': self.submission_id,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'video/3gpp'

    def test_get_attachment_with_id(self):
        attachment_id = self.submissions[0]['_attachments'][0]['id']
        url = reverse(
            self._get_endpoint('attachment-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'parent_lookup_data': self.submission_id,
                'pk': attachment_id,
            },
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'video/3gpp'

    def test_duplicate_attachment_with_submission(self):
        # Grab the original submission and attachment
        submission = self.submissions[0]
        url = reverse(
            self._get_endpoint('attachment-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'parent_lookup_data': submission['_id'],
                'pk': submission['_attachments'][0]['id'],
            },
        )
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'video/3gpp'
        original_file = response.data

        # Duplicate the submission
        with patch('mimetypes.guess_type') as guess_mock:
            guess_mock.side_effect = guess_type_mock
            duplicate_url = reverse(
                self._get_endpoint('submission-duplicate'),
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'pk': submission['_id'],
                },
            )
            response = self.client.post(duplicate_url, {'format': 'json'})
        duplicate_submission = response.data

        # Increment the max attachment id of the original submission to get the
        # id of the first attachment of the duplicated submission
        max_attachment_id = max(a['id'] for a in submission['_attachments'])
        url = reverse(
            self._get_endpoint('attachment-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'parent_lookup_data': duplicate_submission['_id'],
                'pk': max_attachment_id + 1,
            },
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'video/3gpp'
        duplicate_file = response.data

        # Ensure that the files are the same
        with default_storage.open(str(original_file), 'rb') as of:
            with default_storage.open(str(duplicate_file), 'rb') as df:
                assert of.read() == df.read()

    def test_xpath_not_found(self):
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
                    'parent_lookup_data': self.submission_id,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response['Content-Type'] == 'application/json'
        assert response.data['detail'].code == 'xpath_not_found'

    def test_invalid_xpath_syntax(self):
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
                    'parent_lookup_data': self.submission_id,
                },
            ),
            querystring=query_dict.urlencode()
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data['detail'].code == 'invalid_xpath'

    def test_get_attachment_with_submission_uuid(self):

        submission = self.submissions[0]
        url = reverse(
            self._get_endpoint('attachment-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'parent_lookup_data': submission['_uuid'],
                'pk': submission['_attachments'][0]['id'],
            },
        )

        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'video/3gpp'

    def test_thumbnail_creation_on_demand(self):
        submission = self.submissions[0]
        url = reverse(
            self._get_endpoint('attachment-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'parent_lookup_data': submission['_id'],
                'pk': submission['_attachments'][1]['id'],
            },
        )
        response = self.client.get(url)
        filename = response.data.name.replace('.jpg', '')
        thumbnail = f'{filename}-small.jpg'
        # Thumbs should not exist yet
        self.assertFalse(default_storage.exists(thumbnail))

        thumb_url = reverse(
            self._get_endpoint('attachment-thumb'),
            args=(
                self.asset.uid,
                submission['_id'],
                submission['_attachments'][1]['id'],
                'small'
            ),
        )
        self.client.get(thumb_url)
        # Thumbs should exist
        self.assertTrue(default_storage.exists(thumbnail))
