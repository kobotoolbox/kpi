# coding: utf-8
import os
import shutil
import tempfile
import zipfile
from io import StringIO

from django.conf import settings
from django.core.management import call_command
from django.test import Client
from django.urls import reverse

from kobo.apps.openrosa.apps.logger.import_tools import import_instances_from_zip
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.views import (
    bulksubmission,
    bulksubmission_form,
)
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.permissions import assign_perm
from kobo.apps.openrosa.libs.utils.storage import rmdir
from kpi.constants import PERM_ADD_SUBMISSIONS
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)

CUR_PATH = os.path.abspath(__file__)
CUR_DIR = os.path.dirname(CUR_PATH)
DB_FIXTURES_PATH = os.path.join(CUR_DIR, 'data_from_sdcard')
BULK_SUBMISSION_ZIP_PATH = os.path.join(DB_FIXTURES_PATH, 'bulk_submission.zip')


class TestImportingDatabase(TestBase):

    def setUp(self):
        TestBase.setUp(self)
        self.xform = self._publish_xls_file(
            os.path.join(
                settings.OPENROSA_APP_DIR,
                'apps',
                'logger',
                'fixtures',
                'test_forms',
                'tutorial.xls',
            )
        )

    def _images_count(self, instance):
        placeholder_path = '{username}/attachments/{xform_uuid}/{instance_uuid}'
        attachments_path = placeholder_path.format(
            username=self.user.username,
            xform_uuid=instance.xform.uuid,
            instance_uuid=instance.uuid,
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

        request = self.factory.post('/')
        request.user = self.user
        import_instances_from_zip(
            os.path.join(DB_FIXTURES_PATH, 'bulk_submission.zip'), request
        )

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
        request = self.factory.post('/')
        request.user = self.user
        total, success, errors = import_instances_from_zip(
            os.path.join(CUR_DIR, 'Water_Translated_2011_03_10.xml'), request
        )
        self.assertEqual(total, 0)
        self.assertEqual(success, 0)
        expected_errors = ['File is not a zip file']
        self.assertEqual(errors, expected_errors)

    def test_bulk_import_post(self):
        zip_file_path = os.path.join(
            DB_FIXTURES_PATH, 'bulk_submission_w_extra_instance.zip'
        )
        url = reverse(bulksubmission, kwargs={'username': self.user.username})
        with open(zip_file_path, 'rb') as zip_file:
            post_data = {'zip_submission_file': zip_file}
            response = self.client.post(url, post_data)
        self.assertEqual(response.status_code, 200)

    def test_bulk_import_post_with_username_in_uppercase(self):
        zip_file_path = os.path.join(
            DB_FIXTURES_PATH, 'bulk_submission_w_extra_instance.zip'
        )
        url = reverse(bulksubmission, kwargs={'username': self.user.username.upper()})
        with open(zip_file_path, 'rb') as zip_file:
            post_data = {'zip_submission_file': zip_file}
            response = self.client.post(url, post_data)
        self.assertEqual(response.status_code, 200)

    def test_bulk_import_post_anonymous(self):
        url = reverse(bulksubmission, kwargs={'username': self.user.username})
        with open(BULK_SUBMISSION_ZIP_PATH, 'rb') as zip_file:
            response = self.anon.post(url, {'zip_submission_file': zip_file})
        assert response.status_code == 302
        assert not Instance.objects.exists()

    def test_bulk_import_post_to_another_user(self):
        _, alice_client = self._create_user_with_profile_and_login('alice')
        url = reverse(bulksubmission, kwargs={'username': self.user.username})
        with open(BULK_SUBMISSION_ZIP_PATH, 'rb') as zip_file:
            response = alice_client.post(url, {'zip_submission_file': zip_file})
        assert response.status_code == 403
        assert not Instance.objects.exists()

    def test_bulk_import_post_without_permission(self):
        _, alice_client = self._create_user_with_profile_and_login('alice')
        url = reverse(bulksubmission, kwargs={'username': 'alice'})
        with open(BULK_SUBMISSION_ZIP_PATH, 'rb') as zip_file:
            response = alice_client.post(url, {'zip_submission_file': zip_file})
        assert response.status_code == 200
        assert not Instance.objects.exists()

    def test_bulk_import_post_with_permission(self):
        alice, alice_client = self._create_user_with_profile_and_login('alice')
        assign_perm(PERM_ADD_SUBMISSIONS, alice, self.xform.asset)
        url = reverse(bulksubmission, kwargs={'username': 'alice'})
        with open(BULK_SUBMISSION_ZIP_PATH, 'rb') as zip_file:
            response = alice_client.post(url, {'zip_submission_file': zip_file})
        assert response.status_code == 200
        assert Instance.objects.filter(xform=self.xform).exists()

    def test_bulk_import_post_without_csrf_token(self):
        client = self._get_csrf_enforcing_client()
        url = reverse(bulksubmission, kwargs={'username': self.user.username})
        with open(BULK_SUBMISSION_ZIP_PATH, 'rb') as zip_file:
            response = client.post(url, {'zip_submission_file': zip_file})
        assert response.status_code == 403
        assert not Instance.objects.exists()

    def test_bulk_import_post_with_csrf_token_from_form(self):
        client = self._get_csrf_enforcing_client()
        form_url = reverse(bulksubmission_form, kwargs={'username': self.user.username})
        assert client.get(form_url).status_code == 200
        url = reverse(bulksubmission, kwargs={'username': self.user.username})
        with open(BULK_SUBMISSION_ZIP_PATH, 'rb') as zip_file:
            response = client.post(
                url,
                {
                    'zip_submission_file': zip_file,
                    'csrfmiddlewaretoken': client.cookies['csrftoken'].value,
                },
            )
        assert response.status_code == 200
        assert Instance.objects.filter(xform=self.xform).count() == 2

    def test_import_instances_command_from_zip(self):
        self._call_import_instances(BULK_SUBMISSION_ZIP_PATH)
        assert Instance.objects.filter(xform=self.xform).count() == 2

    def test_import_instances_command_from_legacy_odk_dir(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            self._extract_odk_dir(tmp_dir)
            self._call_import_instances(tmp_dir)
        assert Instance.objects.filter(xform=self.xform).count() == 2

    def test_import_instances_command_from_collect_project_dir(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            odk_dir = self._extract_odk_dir(tmp_dir)
            projects_dir = os.path.join(tmp_dir, 'projects')
            os.mkdir(projects_dir)
            shutil.move(odk_dir, os.path.join(projects_dir, 'project_uuid'))
            self._call_import_instances(projects_dir)
        assert Instance.objects.filter(xform=self.xform).count() == 2

    def test_import_instances_command_from_enketo_zip(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            instances_dir = os.path.join(self._extract_odk_dir(tmp_dir), 'instances')
            enketo_zip_path = os.path.join(tmp_dir, 'tutorial_2026-03-23_12-00-00.zip')
            with zipfile.ZipFile(enketo_zip_path, 'w') as enketo_zip:
                enketo_zip.writestr('meta.json', '[]')
                for record_dir in os.scandir(instances_dir):
                    for entry in os.scandir(record_dir.path):
                        if entry.name.endswith('.xml'):
                            name = 'submission.xml'
                        else:
                            name = entry.name
                        enketo_zip.write(
                            entry.path, os.path.join(record_dir.name, name)
                        )
            self._call_import_instances(enketo_zip_path)
        assert Instance.objects.filter(xform=self.xform).count() == 2

    def _call_import_instances(self, path):
        call_command('import_instances', self.user.username, path, stdout=StringIO())

    def _create_user_with_profile_and_login(self, username):
        user = self._create_user(username, username)
        UserProfile.objects.get_or_create(user_id=user.pk)
        return user, self._login(username, username)

    def _extract_odk_dir(self, dest_dir):
        with zipfile.ZipFile(BULK_SUBMISSION_ZIP_PATH) as zip_file:
            zip_file.extractall(dest_dir)
        return os.path.join(dest_dir, 'bulk_submission', 'odk')

    def _get_csrf_enforcing_client(self):
        client = Client(enforce_csrf_checks=True)
        assert client.login(username=self.login_username, password=self.login_password)
        return client
