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


class AttachmentDeleteApiTests(BaseAssetTestCase):
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

        self.first_instance = Instance.objects.get(root_uuid='test_uuid1')
        self.second_instance = Instance.objects.get(root_uuid='test_uuid2')
        self.third_instance = Instance.objects.get(root_uuid='test_uuid3')

        self.submission_root_uuid_1 = self.first_instance.root_uuid
        self.submission_root_uuid_2 = self.second_instance.root_uuid
        self.submission_root_uuid_3 = self.third_instance.root_uuid

        self.submission_root_uuids = [
            self.submission_root_uuid_1,
            self.submission_root_uuid_2,
            self.submission_root_uuid_3,
        ]

        self.attachment_uid_1 = self.first_instance.attachments.all()[0].uid
        self.attachment_uid_2 = self.first_instance.attachments.all()[1].uid
        self.attachment_uid_3 = self.second_instance.attachments.all()[0].uid
        self.attachment_uid_4 = self.second_instance.attachments.all()[1].uid
        self.attachment_uid_5 = self.third_instance.attachments.all()[0].uid
        self.attachment_uid_6 = self.third_instance.attachments.all()[1].uid

        self.attachment_uids = [
            self.attachment_uid_1,
            self.attachment_uid_2,
            self.attachment_uid_3,
            self.attachment_uid_4,
            self.attachment_uid_5,
            self.attachment_uid_6,
        ]

        self.attachment_id_1 = self.first_instance.attachments.all()[0].id
        self.attachment_id_2 = self.first_instance.attachments.all()[1].id
        self.attachment_id_3 = self.second_instance.attachments.all()[0].id
        self.attachment_id_4 = self.second_instance.attachments.all()[1].id
        self.attachment_id_5 = self.third_instance.attachments.all()[0].id
        self.attachment_id_6 = self.third_instance.attachments.all()[1].id

        self.attachment_ids = [
            self.attachment_id_1,
            self.attachment_id_2,
            self.attachment_id_3,
            self.attachment_id_4,
            self.attachment_id_5,
            self.attachment_id_6,
        ]

    def test_delete_single_attachment_success(self):
        initial_trash_count = AttachmentTrash.objects.count()
        url = reverse(
            self._get_endpoint('asset-attachments-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.attachment_uid_1,
            },
        )
        response = self.client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert response.data == {'message': '1 attachments deleted'}
        assert AttachmentTrash.objects.count() == initial_trash_count + 1
        assert not Attachment.objects.filter(uid=self.attachment_uid_1).exists()

    def test_delete_single_attachment_invalid_uid(self):
        url = reverse(
            self._get_endpoint('asset-attachments-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': 'invalid',
            },
        )
        response = self.client.delete(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data == {
            'attachment_uid': [
                ErrorDetail(string='Invalid attachment UID', code='invalid')
            ]
        }

    def test_delete_single_attachment_updates_is_deleted_flag_in_mongo(self):
        """
        Test that when an attachment is deleted (moved to trash),
        the `is_deleted` flag is correctly set in MongoDB
        """
        # Check the initial submission details
        submission_detail_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.first_instance.pk,
            },
        )
        response = self.client.get(submission_detail_url)
        assert response.status_code == status.HTTP_200_OK

        for attachment in response.data['_attachments']:
            assert attachment['is_deleted'] is False

        # Delete the attachment
        delete_url = reverse(
            self._get_endpoint('asset-attachments-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.attachment_uid_1,
            },
        )
        delete_response = self.client.delete(delete_url)

        assert delete_response.status_code == status.HTTP_204_NO_CONTENT
        assert AttachmentTrash.objects.count() == 1

        # Check the updated submission details
        updated_response = self.client.get(submission_detail_url)
        assert updated_response.status_code == status.HTTP_200_OK

        for attachment in updated_response.data['_attachments']:
            if attachment['uid'] == self.attachment_uid_1:
                assert attachment['is_deleted'] is True
            else:
                assert attachment['is_deleted'] is False

    def test_delete_bulk_attachments_updates_is_deleted_flag_in_mongo(self):
        """
        Test that when attachments are deleted (moved to trash),
        the `is_deleted` flag is correctly set in MongoDB
        """
        # Check the initial submission details
        submission_detail_url = reverse(
            self._get_endpoint('submission-detail'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': self.first_instance.pk,
            },
        )
        response = self.client.get(submission_detail_url)
        assert response.status_code == status.HTTP_200_OK

        for attachment in response.data['_attachments']:
            assert attachment['is_deleted'] is False

        # Delete the attachment
        delete_response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {
                    'submission_root_uuids': [self.first_instance.root_uuid]
                }
            ),
            content_type='application/json',
        )

        assert delete_response.status_code == status.HTTP_202_ACCEPTED
        assert delete_response.data == {'message': '2 attachments deleted'}
        assert AttachmentTrash.objects.count() == 2

        # Check the updated submission details
        updated_response = self.client.get(submission_detail_url)
        assert updated_response.status_code == status.HTTP_200_OK

        for attachment in updated_response.data['_attachments']:
            assert attachment['is_deleted'] is True

    def test_bulk_delete_attachments_success(self):
        initial_trash_count = AttachmentTrash.objects.count()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'submission_root_uuids': self.submission_root_uuids}),
            content_type='application/json',
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data == {'message': '6 attachments deleted'}
        assert AttachmentTrash.objects.count() == initial_trash_count + 6
        assert not Attachment.objects.filter(uid__in=self.attachment_uids).exists()

    def test_bulk_delete_attachments_from_other_project_are_ignored(self):
        initial_trash_count = AttachmentTrash.objects.count()
        submission_root_uuids = list(self.submission_root_uuids)

        # Create a second asset
        new_asset = Asset.objects.create(
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
        new_asset.deploy(backend='mock', active=True)
        new_asset.save()

        anotheruser = User.objects.get(username='anotheruser')
        anotheruser.user_permissions.clear()
        self.asset.assign_perm(anotheruser, PERM_CHANGE_SUBMISSIONS)

        self.client.force_login(anotheruser)

        submission = {
            '__version__': new_asset.latest_deployed_version.uid,
            'meta': {'instanceID': 'uuid:test2_uuid1'},
            'q1': 'audio_conversion_test_clip.3gp',
            'q2': 'audio_conversion_test_image.jpg',
            '_attachments': [
                {
                    'filename': (
                        f'{new_asset.owner.username}'
                        '/audio_conversion_test_clip.3gp'
                    ),
                    'mimetype': 'video/3gpp',
                },
                {
                    'filename': (
                        f'{new_asset.owner.username}'
                        '/audio_conversion_test_image.jpg'
                    ),
                    'mimetype': 'image/jpeg',
                },
            ],
            '_submitted_by': new_asset.owner.username,
        }
        new_asset.deployment.mock_submissions([submission], create_uuids=False)
        submission_root_uuids.append('test2_uuid1')

        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'submission_root_uuids': submission_root_uuids}),
            content_type='application/json',
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert AttachmentTrash.objects.count() == initial_trash_count + 6
        new_attachment_ids = list(
            Attachment.objects.filter(
                instance__root_uuid='test2_uuid1'
            ).values_list('pk', flat=True)
        )
        assert not AttachmentTrash.objects.filter(
            attachment_id__in=new_attachment_ids
        ).exists()

    def test_bulk_delete_attachments_empty_submission_root_uuid_list(self):
        initial_trash_count = AttachmentTrash.objects.count()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'submission_root_uuids': []}),
            content_type='application/json',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data == {
            'submission_root_uuids': [
                ErrorDetail(string='List cannot be empty', code='invalid')
            ]
        }
        assert AttachmentTrash.objects.count() == initial_trash_count
        assert not AttachmentTrash.objects.filter(
            attachment_id__in=self.attachment_ids
        ).exists()

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

        assert not AttachmentTrash.objects.filter(
            attachment_id__in=self.attachment_ids
        ).exists()

    def test_bulk_delete_attachments_unauthenticated(self):
        self.client.logout()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'submission_root_uuids': self.submission_root_uuids}),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data == {
            'detail': ErrorDetail(string='Not found.', code='not_found')
        }

    def test_bulk_delete_not_shared_attachment_as_anotheruser(self):
        anotheruser = User.objects.get(username='anotheruser')
        anotheruser.user_permissions.clear()
        self.asset.assign_perm(anotheruser, PERM_VIEW_SUBMISSIONS)

        self.client.force_login(anotheruser)
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps({'submission_root_uuids': self.submission_root_uuids}),
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
            data=json.dumps({'submission_root_uuids': self.submission_root_uuids}),
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data == {'message': '6 attachments deleted'}
        assert not Attachment.objects.filter(uid__in=self.attachment_uids).exists()

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
            data=json.dumps({'submission_root_uuids': [self.submission_root_uuid_3]}),
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
                    'submission_root_uuids': [
                        self.submission_root_uuid_1,
                        self.submission_root_uuid_3,
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
