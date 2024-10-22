# coding: utf-8
import os

from django.conf import settings
from rest_framework.reverse import reverse

from kobo.apps.openrosa.apps.api.tests.viewsets.test_abstract_viewset import (
    TestAbstractViewSet,
)
from kobo.apps.openrosa.apps.api.viewsets.attachment_viewset import AttachmentViewSet
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.main.models import UserProfile


class TestAttachmentViewSet(TestAbstractViewSet):

    def setUp(self):
        super().setUp()
        self.retrieve_view = AttachmentViewSet.as_view({
            'get': 'retrieve'
        })
        self.list_view = AttachmentViewSet.as_view({
            'get': 'list'
        })

        self.publish_xls_form()

        alice_profile_data = {
            'username': 'alice',
            'email': 'alice@kobotoolbox.org',
            'password1': 'alice',
            'password2': 'alice',
            'name': 'Alice',
            'city': 'AliceTown',
            'country': 'CA',
            'organization': 'Alice Inc.',
            'home_page': 'alice.com',
            'twitter': 'alicetwitter'
        }

        alice_profile = self._create_user_profile(alice_profile_data)
        self.alice = alice_profile.user
        # re-assign `self.user` and `self.profile_data` to bob
        self._login_user_and_profile(self.default_profile_data.copy())

    def _retrieve_view(self, auth_headers):
        self._submit_transport_instance_w_attachment()

        pk = self.attachment.pk
        data = {
            'url': 'http://testserver/api/v1/media/%s' % pk,
            'field_xpath': None,
            'download_url': self.attachment.secure_url(),
            'small_download_url': self.attachment.secure_url('small'),
            'medium_download_url': self.attachment.secure_url('medium'),
            'large_download_url': self.attachment.secure_url('large'),
            'id': pk,
            'xform': self.xform.pk,
            'instance': self.attachment.instance.pk,
            'mimetype': self.attachment.mimetype,
            'filename': self.attachment.media_file.name
        }
        request = self.factory.get('/', **auth_headers)
        response = self.retrieve_view(request, pk=pk)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.data, dict))

        self.assertEqual(response.data, data)

        # file download
        filename = data['filename']
        ext = filename[filename.rindex('.') + 1:]
        request = self.factory.get('/', **auth_headers)
        response = self.retrieve_view(request, pk=pk, format=ext)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, 'image/jpeg')

    def test_retrieve_view(self):
        self._retrieve_view(self.extra)

    def test_list_view(self):
        self._submit_transport_instance_w_attachment()

        request = self.factory.get('/', **self.extra)
        response = self.list_view(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.data, list))

    def test_list_view_filter_by_xform(self):
        self._submit_transport_instance_w_attachment()

        data = {
            'xform': self.xform.pk
        }
        request = self.factory.get('/', data, **self.extra)
        response = self.list_view(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.data, list))

        data['xform'] = 10000000
        request = self.factory.get('/', data, **self.extra)
        response = self.list_view(request)
        self.assertEqual(response.status_code, 404)

        data['xform'] = 'lol'
        request = self.factory.get('/', data, **self.extra)
        response = self.list_view(request)
        self.assertEqual(response.status_code, 400)

    def test_list_view_filter_by_instance(self):
        self._submit_transport_instance_w_attachment()

        data = {
            'instance': self.attachment.instance.pk
        }
        request = self.factory.get('/', data, **self.extra)
        response = self.list_view(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.data, list))

        data['instance'] = 10000000
        request = self.factory.get('/', data, **self.extra)
        response = self.list_view(request)
        self.assertEqual(response.status_code, 404)

        data['instance'] = 'lol'
        request = self.factory.get('/', data, **self.extra)
        response = self.list_view(request)
        self.assertEqual(response.status_code, 400)

    def test_direct_image_link(self):
        self._submit_transport_instance_w_attachment()

        data = {
            'filename': self.attachment.media_file.name
        }
        request = self.factory.get('/', data, **self.extra)
        response = self.retrieve_view(request, pk=self.attachment.pk)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.data, str))
        self.assertEqual(response.data, self.attachment.secure_url())

        data['filename'] = 10000000
        request = self.factory.get('/', data, **self.extra)
        response = self.retrieve_view(request, pk=self.attachment.instance.pk)
        self.assertEqual(response.status_code, 404)

        data['filename'] = 'lol'
        request = self.factory.get('/', data, **self.extra)
        response = self.retrieve_view(request, pk=self.attachment.instance.pk)
        self.assertEqual(response.status_code, 404)

    def test_direct_image_link_uppercase(self):
        self._submit_transport_instance_w_attachment(media_file='1335783522564.JPG')

        filename = self.attachment.media_file.name
        file_base, file_extension = os.path.splitext(filename)
        data = {
            'filename': file_base + file_extension.upper()
        }
        request = self.factory.get('/', data, **self.extra)
        response = self.retrieve_view(request, pk=self.attachment.pk)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(isinstance(response.data, str))
        self.assertEqual(response.data, self.attachment.secure_url())

    def test_attachment_storage_bytes_create_instance_defer_counting(self):
        """
        The normal submission mechanism invokes "defer_counting" to trigger the
        counters calculation at the end of the transaction only, to avoid a
        bottleneck when data is saved.
        """
        self._submit_transport_instance_w_attachment()
        media_file_size = self.attachment.media_file_size

        self.xform.refresh_from_db()
        self.assertEqual(self.xform.attachment_storage_bytes, media_file_size)

        profile = UserProfile.objects.get(user=self.xform.user)
        self.assertEqual(profile.attachment_storage_bytes, media_file_size)

    def test_attachment_storage_bytes_delete_signal(self):
        self.test_attachment_storage_bytes_create_instance_defer_counting()
        self.attachment.delete()
        self.xform.refresh_from_db()
        self.assertEqual(self.xform.attachment_storage_bytes, 0)
        profile = UserProfile.objects.get(user=self.xform.user)
        self.assertEqual(profile.attachment_storage_bytes, 0)

    def test_attachment_storage_bytes_create_instance_signal(self):
        """
        Creating a new submission first and then adding an attachment by
        submitting the same XML alongside that attachment uses the signal
        logic instead of the `defer_counting` performance-optimization logic.

        This method copies some code from
        `_submit_transport_instance_w_attachment()`
        """
        survey_datetime = self.surveys[0]
        xml_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            survey_datetime,
            f'{survey_datetime}.xml',
        )
        media_file_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            survey_datetime,
            '1335783522563.jpg'
        )
        xform = self.xform
        user_profile = UserProfile.objects.get(user=xform.user)
        # First, submit the XML with no attachments
        self._make_submission(xml_path)
        self.assertEqual(self.xform.instances.count(), 1)
        submission_uuid = self.xform.instances.first().uuid
        self.xform.refresh_from_db()
        self.assertEqual(xform.attachment_storage_bytes, 0)
        user_profile.refresh_from_db()
        self.assertEqual(user_profile.attachment_storage_bytes, 0)
        # Submit the same XML again, but this time include the attachment
        with open(media_file_path, 'rb') as media_file:
            self._make_submission(xml_path, media_file=media_file)
        self.assertEqual(self.xform.instances.count(), 1)
        self.assertEqual(self.xform.instances.first().uuid, submission_uuid)
        media_file_size = os.path.getsize(media_file_path)
        self.xform.refresh_from_db()
        self.assertEqual(xform.attachment_storage_bytes, media_file_size)
        user_profile.refresh_from_db()
        self.assertEqual(user_profile.attachment_storage_bytes, media_file_size)

    def test_update_attachment_on_edit(self):
        data = {
            'owner': self.user.username,
            'public': False,
            'public_data': False,
            'description': 'transportation_with_attachment',
            'downloadable': True,
            'encrypted': False,
            'id_string': 'transportation_with_attachment',
            'title': 'transportation_with_attachment',
        }

        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation_with_attachment.xls',
        )
        self.publish_xls_form(data=data, path=path)

        xml_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            'transport_with_attachment',
            'transport_with_attachment.xml',
        )
        media_file_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            'transport_with_attachment',
            '1335783522563.jpg'
        )
        user_profile = UserProfile.objects.get(user=self.xform.user)
        # Submit the same XML again, but this time include the attachment
        with open(media_file_path, 'rb') as media_file:
            self._make_submission(xml_path, media_file=media_file)
        submission_uuid = self.xform.instances.first().uuid
        self.assertEqual(self.xform.instances.count(), 1)
        self.assertEqual(self.xform.instances.first().uuid, submission_uuid)
        media_file_size = os.path.getsize(media_file_path)
        self.xform.refresh_from_db()
        self.assertEqual(self.xform.attachment_storage_bytes, media_file_size)
        user_profile.refresh_from_db()
        self.assertEqual(user_profile.attachment_storage_bytes, media_file_size)

        xml_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            'transport_with_attachment',
            'transport_with_attachment_edit.xml',
        )
        media_file_path = os.path.join(
            self.main_directory,
            'fixtures',
            'transportation',
            'instances',
            'transport_with_attachment',
            'IMG_2235.JPG'
        )

        # Edit are only allowed with service account
        with open(media_file_path, 'rb') as media_file:
            self._make_submission(
                xml_path,
                media_file=media_file,
                use_api=False,
            )

        # Validate counters are up-to-date and instances count is still one.
        self.assertEqual(self.xform.instances.count(), 1)
        new_media_file_size = os.path.getsize(media_file_path)
        self.xform.refresh_from_db()
        self.assertEqual(self.xform.attachment_storage_bytes, new_media_file_size)
        user_profile.refresh_from_db()
        self.assertEqual(user_profile.attachment_storage_bytes, new_media_file_size)
        self.assertNotEqual(new_media_file_size, media_file_size)

        instance = self.xform.instances.first()
        attachment = instance.attachments.first()

        # Validate previous attachment has been replaced but file still exists
        soft_deleted_attachment_qs = Attachment.all_objects.filter(
            instance=instance,
            deleted_at__isnull=False
        )
        self.assertEqual(soft_deleted_attachment_qs.count(), 1)
        soft_deleted_attachment = soft_deleted_attachment_qs.first()
        self.assertEqual(
            soft_deleted_attachment.media_file_basename, '1335783522563.jpg'
        )
        self.assertTrue(
            soft_deleted_attachment.media_file.storage.exists(
                str(soft_deleted_attachment.media_file)
            )
        )

        # Validate that /api/v1/media endpoint returns the correct list
        expected = {
            'url': f'http://testserver/api/v1/media/{attachment.pk}',
            'field_xpath': None,
            'download_url': attachment.secure_url(),
            'small_download_url': attachment.secure_url('small'),
            'medium_download_url': attachment.secure_url('medium'),
            'large_download_url': attachment.secure_url('large'),
            'id': attachment.pk,
            'xform': self.xform.pk,
            'instance': instance.pk,
            'mimetype': attachment.mimetype,
            'filename': attachment.media_file.name
        }
        request = self.factory.get('/', **self.extra)
        response = self.list_view(request, pk=attachment.pk)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data[0], expected)
        self.assertTrue(len(response.data), 1)

        # Validate that /api/v1/data endpoint returns the correct attachment list
        # Unfortunately, attachments list differ from /api/v1/media
        expected = {
            'download_url': expected['download_url'],
            'download_small_url': expected['small_download_url'],
            'download_medium_url': expected['medium_download_url'],
            'download_large_url': expected['large_download_url'],
            'id': expected['id'],
            'xform': expected['xform'],
            'instance': expected['instance'],
            'mimetype': expected['mimetype'],
            'filename': expected['filename']
        }

        instance_response = self.client.get(
            reverse(
                'data-detail',
                kwargs={'pk': self.xform.pk, 'dataid': instance.pk},
            ),
            format='json',
        )
        self.assertEqual(instance_response.data['_attachments'][0], expected)
        self.assertEqual(len(instance_response.data['_attachments']), 1)

    def test_storage_counters_still_accurate_on_hard_delete(self):
        """
        This test is not an API test, not really an Attachment unit test.
        It is there to simplify the code base for attachment replacement.


        """
        self.test_update_attachment_on_edit()
        self.xform.refresh_from_db()

        instance = self.xform.instances.first()
        user_profile = UserProfile.objects.get(user=self.xform.user)
        self.assertEqual(self.xform.instances.count(), 1)
        self.assertNotEqual(self.xform.attachment_storage_bytes, 0)
        self.assertNotEqual(user_profile.attachment_storage_bytes, 0)

        total_size = sum(
            [
                a.media_file_size
                for a in Attachment.all_objects.filter(instance=instance)
            ]
        )

        self.assertGreater(total_size, self.xform.attachment_storage_bytes)

        # When deleting a submission, it (hard) deletes all attachments related
        # to it, even the soft-deleted one.
        self.client.delete(
            reverse(
                'data-detail',
                kwargs={'pk': self.xform.pk, 'dataid': instance.pk},
            ),
            format='json',
        )
        # Only not soft-deleted attachments should have been subtracted,
        # and counters should be equal to 0
        self.assertEqual(self.xform.instances.count(), 0)
        self.xform.refresh_from_db()
        self.assertEqual(self.xform.attachment_storage_bytes, 0)
        user_profile.refresh_from_db()
        self.assertEqual(user_profile.attachment_storage_bytes, 0)
        self.assertFalse(
            Attachment.all_objects.filter(instance=instance).exists()
        )
