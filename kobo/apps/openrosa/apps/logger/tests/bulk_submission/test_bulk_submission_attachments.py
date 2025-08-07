# coding: utf-8
import os

from django.urls import reverse

from kobo.apps.openrosa.apps.logger.import_tools import import_instances_from_zip
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.views import bulksubmission
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.utils.storage import rmdir
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)

CUR_PATH = os.path.abspath(__file__)
CUR_DIR = os.path.dirname(CUR_PATH)

ASSET_UID = 'aLf54MbS5yrNQjwPkLKDms'
XLSX_FILE_PATH = os.path.join(CUR_DIR, ASSET_UID + '.xlsx')
ZIP_FILE_PATH = os.path.join(CUR_DIR, ASSET_UID + '.zip')


class TestBulkSubmissionAttachments(TestBase):

    def setUp(self):
        TestBase.setUp(self)
        self._publish_xls_file(XLSX_FILE_PATH)

    def _stored_attachment_basenames(self, instance):
        placeholder_path = '{username}/attachments/{xform_uuid}/{instance_uuid}'
        attachments_path = placeholder_path.format(
            username=self.user.username,
            xform_uuid=instance.xform.uuid,
            instance_uuid=instance.uuid,
        )
        _, attachments = default_storage.listdir(attachments_path)
        return attachments

    def tearDown(self):
        # delete everything we imported
        Instance.objects.all().delete()
        if self.user and self.user.username:
            rmdir(self.user.username)

    def test_bulk_import_attachments_zip(self):
        self.assertFalse(Instance.objects.exists())

        import_instances_from_zip(ZIP_FILE_PATH, self.user)

        queryset = Instance.objects

        self.assertEqual(queryset.count(), 2)

        basenames_count = 0
        for instance in queryset.all():

            # Check the database
            expected = [
                ('test.pdf', 'application/pdf'),
                ('thanks.png', 'image/png'),
                ('wave.wav', 'audio/x-wav'),
            ]
            actual = list(
                instance.attachments.order_by(
                    'media_file_basename'
                ).values_list('media_file_basename', 'mimetype')
            )
            self.assertEqual(actual, expected)

            # Check the filesystem
            basenames = self._stored_attachment_basenames(instance)
            self.assertEqual(
                sorted(basenames),
                # Both submissions in the zipfile use these names
                sorted(['test.pdf', 'thanks.png', 'wave.wav']))
            basenames_count += len(basenames)

        # Expect 6 new attachments total (wav, png, pdf)
        self.assertEqual(basenames_count, 6)


    def test_bulk_import_attachments_post(self):
        url = reverse(bulksubmission, kwargs={'username': self.user.username})
        with open(ZIP_FILE_PATH, 'rb') as zip_file:
            post_data = {'zip_submission_file': zip_file}
            response = self.client.post(url, post_data)
        self.assertEqual(response.status_code, 200)
