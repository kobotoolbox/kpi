import json
import os

from django.conf import settings
from django.core.files.base import File
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
                        '$kuid': 'abcd',
                    },
                    {
                        'type': 'file',
                        'label': 'q2',
                        'required': 'false',
                        '$kuid': 'efgh',
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
        xml_str1 = """
        <data>
            <q1>audio.3gp</q1>
            <q2>image.jpg</q2>
            <meta>
                <instanceID>uuid:test_uuid1</instanceID>
            </meta>
        </data>
        """
        xml_str2 = """
        <data>
            <q1>audio.3gp</q1>
            <q2>image.jpg</q2>
            <meta>
                <instanceID>uuid:test_uuid2</instanceID>
            </meta>
        </data>
        """

        instance1 = Instance.objects.create(
            xform=self.asset.deployment.xform, xml=xml_str1
        )
        instance2 = Instance.objects.create(
            xform=self.asset.deployment.xform, xml=xml_str2
        )

        media_file_name = '1335783522563.jpg'
        media_file_path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'instances',
            'transport_2011-07-25_19-05-49',
            media_file_name,
        )

        attachment1 = Attachment.objects.create(
            instance=instance1,
            media_file=File(open(media_file_path, 'rb'), media_file_name),
        )
        attachment2 = Attachment.objects.create(
            instance=instance2,
            media_file=File(open(media_file_path, 'rb'), media_file_name),
        )

        self.attachment1_uid = attachment1.uid
        self.attachment2_uid = attachment2.uid

    def test_bulk_delete_attachments_success(self):
        initial_trash_count = AttachmentTrash.objects.count()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {'attachment_uids': [self.attachment1_uid, self.attachment2_uid]}
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data, {'message': '2 attachments deleted'})
        self.assertEqual(AttachmentTrash.objects.count(), initial_trash_count + 2)
        self.assertFalse(Attachment.objects.filter(uid=self.attachment1_uid).exists())
        self.assertFalse(Attachment.objects.filter(uid=self.attachment2_uid).exists())

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
            {
                'non_field_errors': [
                    ErrorDetail(
                        string='The list of attachment UIDs cannot be empty',
                        code='invalid',
                    )
                ]
            },
        )
        self.assertEqual(AttachmentTrash.objects.count(), initial_trash_count)
        self.assertFalse(
            AttachmentTrash.objects.filter(uid=self.attachment1_uid).exists()
        )
        self.assertFalse(
            AttachmentTrash.objects.filter(uid=self.attachment2_uid).exists()
        )

    def test_bulk_delete_attachments_no_payload(self):
        response = self.client.delete(
            self.bulk_delete_url, data='invalid json', content_type='application/json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data,
            {
                'detail': ErrorDetail(
                    string=(
                        'JSON parse error - Expecting value: '
                        'line 1 column 1 (char 0)'
                    ),
                    code='parse_error',
                )
            },
        )
        self.assertTrue(Attachment.objects.filter(uid=self.attachment1_uid).exists())
        self.assertTrue(Attachment.objects.filter(uid=self.attachment2_uid).exists())
        self.assertFalse(
            AttachmentTrash.objects.filter(uid=self.attachment1_uid).exists()
        )
        self.assertFalse(
            AttachmentTrash.objects.filter(uid=self.attachment2_uid).exists()
        )

    def test_bulk_delete_attachments_unauthenticated(self):
        self.client.logout()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {'attachment_uids': [self.attachment1_uid, self.attachment2_uid]}
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data,
            {
                'detail': ErrorDetail(
                    string='You do not have permission to delete these attachments',
                    code='permission_denied',
                )
            },
        )

    def test_bulk_delete_not_shared_attachment_as_anotheruser(self):
        anotherUser = User.objects.create(
            username='anotherUser', password='anotherUser'
        )
        anotherUser.user_permissions.clear()
        self.asset.assign_perm(anotherUser, PERM_VIEW_SUBMISSIONS)

        self.client.force_login(anotherUser)
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {'attachment_uids': [self.attachment1_uid, self.attachment2_uid]}
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data,
            {
                'detail': ErrorDetail(
                    string='You do not have permission to delete these attachments',
                    code='permission_denied',
                )
            },
        )

    def test_bulk_delete_attachments_edit_permission(self):
        userEditPerms = User.objects.create_user(
            username='userEditPerms', password='userEditPerms'
        )
        self.asset.assign_perm(userEditPerms, 'kpi.change_submissions')
        self.client.logout()
        self.client.force_login(userEditPerms)
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {'attachment_uids': [self.attachment1_uid, self.attachment2_uid]}
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data, {'message': '2 attachments deleted'})

    def test_bulk_delete_attachments_with_partial_perms(self):
        userPartialPerms = User.objects.create_user(
            username='userPartialPerms', password='userPartialPerms'
        )
        self.client.force_login(userPartialPerms)
        partial_perms = {
            PERM_CHANGE_SUBMISSIONS: [{'_submitted_by': 'userPartialPerms'}]
        }
        self.asset.assign_perm(
            userPartialPerms,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms=partial_perms,
        )
        initial_trash_count = AttachmentTrash.objects.count()
        response = self.client.delete(
            self.bulk_delete_url,
            data=json.dumps(
                {'attachment_uids': [self.attachment1_uid, self.attachment2_uid]}
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data, {'message': '2 attachments deleted'})
        self.assertEqual(AttachmentTrash.objects.count(), initial_trash_count + 2)
