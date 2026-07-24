import json
from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kpi.models.asset import Asset
from kpi.serializers.v2.attachment_audio_duration import AUDIO_DURATION_MAX_BATCH_SIZE
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE

AUDIO_DURATION_LIST_ENDPOINT = 'asset-attachment-audio-duration-list'


def _ffprobe_ok(duration: float):
    """
    Return a mock subprocess.CompletedProcess for a successful ffprobe call
    """
    mock_result = MagicMock()
    mock_result.stdout = json.dumps({'format': {'duration': str(duration)}})
    mock_result.returncode = 0
    return mock_result


def _ffprobe_fail():
    """
    Return a mock subprocess.CompletedProcess simulating an ffprobe error
    """
    mock_result = MagicMock()
    mock_result.stdout = 'invalid json'
    mock_result.returncode = 1
    return mock_result


class AttachmentAudioDurationApiTests(BaseAssetTestCase):
    """
    Tests for POST /api/v2/assets/{uid_asset}/attachments/audio-duration/
    """

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.asset = Asset.objects.create(
            content={
                'survey': [
                    {'type': 'audio', 'label': 'q1', 'required': 'false'},
                ]
            },
            owner=self.someuser,
            asset_type='survey',
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        self._create_instances_and_attachments()
        self.url = reverse(
            self._get_endpoint(AUDIO_DURATION_LIST_ENDPOINT),
            kwargs={'uid_asset': self.asset.uid},
        )

    def _create_instances_and_attachments(self):
        fixture_audio = 'audio_conversion_test_clip.3gp'
        submissions = [
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'meta': {'instanceID': 'uuid:audio_dur_uuid1'},
                'q1': fixture_audio,
                '_attachments': [
                    {
                        'filename': f'{self.someuser.username}/{fixture_audio}',
                        'mimetype': 'audio/3gpp',
                    },
                ],
                '_submitted_by': self.someuser.username,
            },
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'meta': {'instanceID': 'uuid:audio_dur_uuid2'},
                'q1': fixture_audio,
                '_attachments': [
                    {
                        'filename': f'{self.someuser.username}/{fixture_audio}',
                        'mimetype': 'audio/3gpp',
                    },
                ],
                '_submitted_by': self.someuser.username,
            },
        ]
        self.asset.deployment.mock_submissions(submissions, create_uuids=False)

        self.instance1 = Instance.objects.get(root_uuid='audio_dur_uuid1')
        self.instance2 = Instance.objects.get(root_uuid='audio_dur_uuid2')

        self.attachment1 = self.instance1.attachments.first()
        self.attachment2 = self.instance2.attachments.first()

    def test_returns_cached_audio_length(self):
        """
        Attachments with a pre-populated audio_length skip ffprobe entirely
        """
        self.attachment1.audio_length = 30.7
        self.attachment1.save(update_fields=['audio_length'])

        with patch('kpi.utils.audio_duration.subprocess.run') as mock_run:
            response = self.client.post(
                self.url,
                {'attachment_uids': [self.attachment1.uid]},
                format='json',
            )

        assert response.status_code == status.HTTP_200_OK
        mock_run.assert_not_called()
        assert response.data['attachments'] == [
            {'uid': self.attachment1.uid, 'seconds': 30}
        ]
        assert response.data['total'] == 30

    def test_runs_ffprobe_when_audio_length_is_null(self):
        """
        When audio_length is null, ffprobe is called and its result saved
        """
        assert self.attachment1.audio_length is None

        with patch(
            'kpi.utils.audio_duration.subprocess.run',
            return_value=_ffprobe_ok(45.9),
        ):
            response = self.client.post(
                self.url,
                {'attachment_uids': [self.attachment1.uid]},
                format='json',
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['attachments'] == [
            {'uid': self.attachment1.uid, 'seconds': 45}
        ]
        assert response.data['total'] == 45

        # Duration must be persisted so subsequent calls skip ffprobe
        self.attachment1.refresh_from_db()
        assert self.attachment1.audio_length == 45.9

    def test_subsequent_call_uses_db_value(self):
        """
        After the first ffprobe call, a second request must not call ffprobe
        """
        with patch(
            'kpi.utils.audio_duration.subprocess.run',
            return_value=_ffprobe_ok(60.0),
        ):
            self.client.post(
                self.url,
                {'attachment_uids': [self.attachment1.uid]},
                format='json',
            )

        with patch('kpi.utils.audio_duration.subprocess.run') as mock_run:
            response = self.client.post(
                self.url,
                {'attachment_uids': [self.attachment1.uid]},
                format='json',
            )

        assert response.status_code == status.HTTP_200_OK
        mock_run.assert_not_called()
        assert response.data['total'] == 60

    def test_multiple_attachments_totals_correctly(self):
        """
        Total equals the sum of all integer-truncated durations
        """
        self.attachment1.audio_length = 30.9
        self.attachment1.save(update_fields=['audio_length'])
        self.attachment2.audio_length = 20.1
        self.attachment2.save(update_fields=['audio_length'])

        response = self.client.post(
            self.url,
            {'attachment_uids': [self.attachment1.uid, self.attachment2.uid]},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total'] == 50

    def test_ffprobe_failure_returns_null_seconds(self):
        """
        A failed ffprobe call should yield seconds=null for that attachment
        """
        with patch(
            'kpi.utils.audio_duration.subprocess.run',
            return_value=_ffprobe_fail(),
        ):
            response = self.client.post(
                self.url,
                {'attachment_uids': [self.attachment1.uid]},
                format='json',
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['attachments'][0]['seconds'] is None
        assert response.data['total'] == 0

    def test_unknown_uid_is_silently_omitted(self):
        """
        UIDs that do not exist in the DB are omitted without raising an error
        """
        self.attachment1.audio_length = 10.0
        self.attachment1.save(update_fields=['audio_length'])

        response = self.client.post(
            self.url,
            {'attachment_uids': ['att000000000nonexistent', self.attachment1.uid]},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['attachments']) == 1
        assert response.data['attachments'][0]['uid'] == self.attachment1.uid

    def test_attachment_from_different_asset_is_omitted(self):
        """
        A UID belonging to a different asset must be silently omitted even
        when that asset is also owned by the requesting user
        """
        other_asset = Asset.objects.create(
            content={
                'survey': [{'type': 'audio', 'label': 'q1', 'required': 'false'}]
            },
            owner=self.someuser,
            asset_type='survey',
        )
        other_asset.deploy(backend='mock', active=True)
        other_asset.save()
        other_asset.deployment.mock_submissions(
            [
                {
                    '__version__': other_asset.latest_deployed_version.uid,
                    'meta': {'instanceID': 'uuid:other_uuid1'},
                    'q1': 'audio_conversion_test_clip.3gp',
                    '_attachments': [
                        {
                            'filename': (
                                f'{self.someuser.username}/'
                                'audio_conversion_test_clip.3gp'
                            ),
                            'mimetype': 'audio/3gpp',
                        },
                    ],
                    '_submitted_by': self.someuser.username,
                }
            ],
            create_uuids=False,
        )

        other_attachment = Instance.objects.get(
            root_uuid='other_uuid1'
        ).attachments.first()
        other_attachment.audio_length = 99.0
        other_attachment.save(update_fields=['audio_length'])

        # UID belongs to other_asset, but we're querying self.asset's endpoint
        response = self.client.post(
            self.url,
            {'attachment_uids': [other_attachment.uid]},
            format='json',
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['attachments'] == []
        assert response.data['total'] == 0

    def test_unauthenticated_request_returns_404(self):
        """
        Unauthenticated clients must receive 404
        """
        self.client.logout()
        response = self.client.post(
            self.url,
            {'attachment_uids': [self.attachment1.uid]},
            format='json',
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_user_without_view_submissions_receives_404(self):
        """
        A user with no permissions on the asset must receive 404
        """
        self.client.login(username='anotheruser', password='anotheruser')
        response = self.client.post(
            self.url,
            {'attachment_uids': [self.attachment1.uid]},
            format='json',
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_batch_size_at_limit_is_accepted(self):
        """
        Exactly AUDIO_DURATION_MAX_BATCH_SIZE UIDs must be accepted
        """
        uids = [f'att{str(i).zfill(17)}' for i in range(AUDIO_DURATION_MAX_BATCH_SIZE)]
        response = self.client.post(
            self.url, {'attachment_uids': uids}, format='json'
        )
        # All UIDs are unknown but the request itself is valid - 200, empty list
        assert response.status_code == status.HTTP_200_OK
        assert response.data['attachments'] == []

    def test_exceeding_batch_size_returns_400(self):
        """
        One UID over the limit must be rejected with 400
        """
        uids = [
            f'att{str(i).zfill(17)}' for i in range(AUDIO_DURATION_MAX_BATCH_SIZE + 1)
        ]
        response = self.client.post(
            self.url, {'attachment_uids': uids}, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_filesystem_storage_passes_local_path_to_ffprobe(self):
        """
        With FileSystemStorage, ffprobe must receive the local filesystem path
        returned by `attachment.absolute_path`
        """
        fake_path = '/media/someuser/attachments/xform/uuid/clip.mp3'

        with (
            patch.object(
                type(self.attachment1),
                'absolute_path',
                new_callable=lambda: property(lambda self: fake_path),
            ),
            patch(
                'kpi.utils.audio_duration.subprocess.run',
                return_value=_ffprobe_ok(10.0),
            ) as mock_run,
        ):
            response = self.client.post(
                self.url,
                {'attachment_uids': [self.attachment1.uid]},
                format='json',
            )

        assert response.status_code == status.HTTP_200_OK
        called_path = mock_run.call_args[0][0][-1]
        assert called_path == fake_path

    def test_s3_storage_passes_presigned_url_to_ffprobe(self):
        """
        With S3 storage, ffprobe must receive the presigned URL returned by
        `attachment.absolute_path` - no tempfile or local download should occur
        """
        fake_url = (
            'https://my-bucket.s3.amazonaws.com/someuser/attachments/'
            'xform/uuid/clip.mp3?X-Amz-Signature=abc123'
        )

        with (
            patch.object(
                type(self.attachment1),
                'absolute_path',
                new_callable=lambda: property(lambda self: fake_url),
            ),
            patch(
                'kpi.utils.audio_duration.subprocess.run',
                return_value=_ffprobe_ok(25.0),
            ) as mock_run,
        ):
            response = self.client.post(
                self.url,
                {'attachment_uids': [self.attachment1.uid]},
                format='json',
            )

        assert response.status_code == status.HTTP_200_OK
        called_path = mock_run.call_args[0][0][-1]
        assert called_path == fake_url
