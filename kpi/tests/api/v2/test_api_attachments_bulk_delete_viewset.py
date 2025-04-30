import json

from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ErrorDetail

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kpi.constants import (
    PERM_CHANGE_SUBMISSIONS,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models.asset import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AttachmentBulkDeleteApiTests(BaseAssetTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.someuser = User.objects.get(username='someuser')
        self.asset = Asset.objects.create(
            content={
                'survey': [
                    {
                        'type': 'audio',
                        'label': 'q1',
                        'required': 'false',
                    },
                    {
                        'type': 'file',
                        'label': 'q2',
                        'required': 'false',
                    },
                ]
            },
            owner=self.someuser,
            asset_type='survey',
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        self._create_instances_and_attachments()
        self.bulk_delete_url = reverse(
            self._get_endpoint('asset-attachments-bulk'),
            kwargs={'parent_lookup_asset': self.asset.uid},
        )

    def _create_instances_and_attachments(self):
        submissions = [
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'meta': {'instanceID': 'uuid:test_uuid1'},
                'q1': 'audio_conversion_test_clip.3gp',
                'q2': 'audio_conversion_test_image.jpg',
                '_attachments': [
                    {
                        'filename': (
                            f'{self.asset.owner.username}'
                            '/audio_conversion_test_clip.3gp'
                        ),
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'filename': (
                            f'{self.asset.owner.username}'
                            '/audio_conversion_test_image.jpg'
                        ),
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': self.asset.owner.username,
            },
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'meta': {'instanceID': 'uuid:test_uuid2'},
                'q1': 'audio_conversion_test_clip.3gp',
                'q2': 'audio_conversion_test_image.jpg',
                '_attachments': [
                    {
                        'filename': (
                            f'{self.asset.owner.username}'
                            '/audio_conversion_test_clip.3gp'
                        ),
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'filename': (
                            f'{self.asset.owner.username}'
                            '/audio_conversion_test_image.jpg'
                        ),
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': self.asset.owner.username,
            },
            {
                '__version__': self.asset.latest_deployed_version.uid,
                'meta': {'instanceID': 'uuid:test_uuid3'},
                'q1': 'audio_conversion_test_clip.3gp',
                'q2': 'audio_conversion_test_image.jpg',
                '_attachments': [
                    {
                        'filename': (
                            f'{self.asset.owner.username}'
                            '/audio_conversion_test_clip.3gp'
                        ),
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'filename': (
                            f'{self.asset.owner.username}'
                            '/audio_conversion_test_image.jpg'
                        ),
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': 'anotheruser',
            },
        ]
        self.asset.deployment.mock_submissions(submissions, create_uuids=False)

        first_instance = Instance.objects.get(root_uuid='test_uuid1')
        second_instance = Instance.objects.get(root_uuid='test_uuid2')
        third_instance = Instance.objects.get(root_uuid='test_uuid3')

        self.attachment_uid_1 = first_instance.attachments.all()[0].uid
        self.attachment_uid_2 = first_instance.attachments.all()[1].uid
        self.attachment_uid_3 = second_instance.attachments.all()[0].uid
        self.attachment_uid_4 = second_instance.attachments.all()[1].uid
        self.attachment_uid_5 = third_instance.attachments.all()[0].uid
        self.attachment_uid_6 = third_instance.attachments.all()[1].uid

        self.attachment_uids = [
            self.attachment_uid_1,
            self.attachment_uid_2,
            self.attachment_uid_3,
            self.attachment_uid_4,
            self.attachment_uid_5,
            self.attachment_uid_6,
        ]

    def test_bulk_delete_attachments_success(self):
        initial_trash_count = AttachmentTrash.objects.count()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'attachment_uids': self.attachment_uids}),
            content_type='application/json',
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data == {'message': '6 attachments deleted'}
        assert AttachmentTrash.objects.count() == initial_trash_count + 6
        for uid in self.attachment_uids:
            assert not Attachment.objects.filter(uid=uid).exists()

    def test_bulk_delete_attachments_empty_uid_list(self):
        initial_trash_count = AttachmentTrash.objects.count()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'attachment_uids': []}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data,
            [
                ErrorDetail(
                    string='The list of attachment UIDs cannot be empty', code='invalid'
                )
            ],
        )
        assert AttachmentTrash.objects.count() == initial_trash_count
        for uid in self.attachment_uids:
            assert not AttachmentTrash.objects.filter(uid=uid).exists()

    def test_bulk_delete_attachments_no_payload(self):
        response = self.client.delete(
            self.bulk_delete_url, data='invalid json', content_type='application/json'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data == {
            'detail': ErrorDetail(
                string=(
                    'JSON parse error - Expecting value: ' 'line 1 column 1 (char 0)'
                ),
                code='parse_error',
            )
        }

        for uid in self.attachment_uids:
            assert Attachment.objects.filter(uid=uid).exists()
            assert not AttachmentTrash.objects.filter(uid=uid).exists()

    def test_bulk_delete_attachments_unauthenticated(self):
        self.client.logout()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'attachment_uids': self.attachment_uids}),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data == {
            'detail': ErrorDetail(string='Not found.', code='not_found')
        }

    def test_bulk_delete_not_shared_attachment_as_anotheruser(self):
        another_user = User.objects.create(
            username='another_user', password='another_user'
        )
        another_user.user_permissions.clear()
        self.asset.assign_perm(another_user, PERM_VIEW_SUBMISSIONS)

        self.client.force_login(another_user)
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'attachment_uids': self.attachment_uids}),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data == {
            'detail': ErrorDetail(
                string='You do not have permission to perform this action.',
                code='permission_denied',
            )
        }

    def test_bulk_delete_attachments_edit_permission(self):
        user_edit_perms = User.objects.create_user(
            username='user_edit_perms', password='user_edit_perms'
        )
        user_edit_perms.user_permissions.clear()
        self.asset.assign_perm(user_edit_perms, PERM_CHANGE_SUBMISSIONS)
        self.client.logout()
        self.client.force_login(user_edit_perms)
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'attachment_uids': self.attachment_uids}),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data == {'message': '6 attachments deleted'}

    def test_bulk_delete_attachments_with_partial_perms_accepted(self):
        user_partial_perms = User.objects.create_user(
            username='user_partial_perms', password='user_partial_perms'
        )
        self.client.force_login(user_partial_perms)
        partial_perms = {PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}

        self.asset.assign_perm(
            user_partial_perms,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        initial_trash_count = AttachmentTrash.objects.count()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {'attachment_uids': [self.attachment_uid_5, self.attachment_uid_6]}
            ),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data == {'message': '2 attachments deleted'}
        assert AttachmentTrash.objects.count() == initial_trash_count + 2

    def test_bulk_delete_attachments_with_partial_perms_denied(self):
        user_partial_perms = User.objects.create_user(
            username='user_partial_perms', password='user_partial_perms'
        )
        self.client.force_login(user_partial_perms)
        partial_perms = {PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'anotheruser'}]}

        self.asset.assign_perm(
            user_partial_perms,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {
                    'attachment_uids': [
                        self.attachment_uid_1,
                        self.attachment_uid_2,
                        self.attachment_uid_3,
                        self.attachment_uid_4,
                    ]
                }
            ),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data == {
            'detail': ErrorDetail(
                string='You do not have permission to perform this action.',
                code='permission_denied',
            )
        }

    def test_bulk_delete_attachments_uid_mismatch(self):
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {
                    'attachment_uids': [
                        self.attachment_uid_1,
                        self.attachment_uid_2,
                        'nonexistent_uid',
                    ]
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data,
            [
                ErrorDetail(
                    string='One or more of the provided attachment UIDs are invalid',
                    code='invalid',
                )
            ],
        )

        assert Attachment.objects.filter(uid=self.attachment_uid_1).exists()
        assert Attachment.objects.filter(uid=self.attachment_uid_2).exists()
        assert not Attachment.objects.filter(uid='nonexistent_uid').exists()
        assert AttachmentTrash.objects.count() == 0
