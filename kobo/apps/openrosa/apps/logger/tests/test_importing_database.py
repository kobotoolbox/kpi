# coding: utf-8
import os

from django.urls import reverse
from django.conf import settings

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.import_tools import import_instances_from_zip
from kobo.apps.openrosa.apps.logger.views import bulksubmission
from kobo.apps.openrosa.libs.utils.storage import rmdir
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)

CUR_PATH = os.path.abspath(__file__)
CUR_DIR = os.path.dirname(CUR_PATH)
DB_FIXTURES_PATH = os.path.join(CUR_DIR, 'data_from_sdcard')


class TestImportingDatabase(TestBase):

    def setUp(self):
        TestBase.setUp(self)
        self._publish_xls_file(
            os.path.join(
                settings.OPENROSA_APP_DIR, "apps", "logger", "fixtures",
                "test_forms", "tutorial.xls"))

    def _images_count(self, instance):
        placeholder_path = '{username}/attachments/{xform_uuid}/{instance_uuid}'
        attachments_path = placeholder_path.format(
            username=self.user.username,
            xform_uuid=instance.xform.uuid,
            instance_uuid=instance.uuid
        )
        _, images = default_storage.listdir(attachments_path)
        return len(images)

    def tearDown(self):
        # delete everything we imported
        Instance.objects.all().delete()
        if self.user and self.user.username:
            rmdir(self.user.username)

    def test_importing_b1_and_b2(self):
        """
        b1 and b2 are from the *same phone* at different times. (this
        might not be a realistic test)

        b1:
        1 photo survey (completed)
        1 simple survey (not marked complete)

        b2:
        1 photo survey (duplicate, completed)
        1 simple survey (marked as complete)
        """
        queryset = Instance.objects
        # import from sd card
        initial_instances_count = queryset.count()
        initial_images_count = 0
        for instance in queryset.all():
            initial_images_count += self._images_count(instance)

        import_instances_from_zip(os.path.join(
            DB_FIXTURES_PATH, "bulk_submission.zip"), self.user)

        instance_count = Instance.objects.count()
        images_count = 0
        for instance in queryset.all():
            images_count += self._images_count(instance)
        # Images are not duplicated
        self.assertEqual(images_count, initial_images_count + 2)

        # Instance count should have incremented
        # by 1 (or 2) based on the b1 & b2 data sets
        self.assertEqual(instance_count, initial_instances_count + 2)

    def test_badzipfile_import(self):
        total, success, errors = import_instances_from_zip(
            os.path.join(
                CUR_DIR, "Water_Translated_2011_03_10.xml"), self.user)
        self.assertEqual(total, 0)
        self.assertEqual(success, 0)
        expected_errors = ['File is not a zip file']
        self.assertEqual(errors, expected_errors)

    def test_bulk_import_post(self):
        zip_file_path = os.path.join(
            DB_FIXTURES_PATH, "bulk_submission_w_extra_instance.zip")
        url = reverse(bulksubmission, kwargs={
            "username": self.user.username
        })
        with open(zip_file_path, "rb") as zip_file:
            post_data = {'zip_submission_file': zip_file}
            response = self.client.post(url, post_data)
        self.assertEqual(response.status_code, 200)

    def test_bulk_import_post_with_username_in_uppercase(self):
        zip_file_path = os.path.join(
            DB_FIXTURES_PATH, "bulk_submission_w_extra_instance.zip")
        url = reverse(bulksubmission, kwargs={
            "username": self.user.username.upper()
        })
        with open(zip_file_path, "rb") as zip_file:
            post_data = {'zip_submission_file': zip_file}
            response = self.client.post(url, post_data)
        self.assertEqual(response.status_code, 200)
