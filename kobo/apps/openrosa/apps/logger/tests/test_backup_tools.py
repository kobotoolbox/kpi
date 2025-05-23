# coding: utf-8
from datetime import datetime
import os
import tempfile
import shutil

from django.conf import settings

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.import_tools import django_file
from kobo.apps.openrosa.apps.logger.import_tools import create_instance
from kobo.apps.openrosa.libs.utils.backup_tools import (
    _date_created_from_filename,
    create_zip_backup,
    restore_backup_from_zip
)


class TestBackupTools(TestBase):
    def setUp(self):
        super().setUp()
        self._publish_xls_file_and_set_xform(
            os.path.join(
                settings.OPENROSA_APP_DIR,
                "apps", "logger", "fixtures", "test_forms",
                "tutorial.xls"))

    def test_date_created_override(self):
        """
        Test that passing a date_created_override when creating and instance
        will set our date as the date_created
        """
        xml_file_path = os.path.join(
            settings.OPENROSA_APP_DIR, 'apps', 'logger', 'fixtures',
            'tutorial', 'instances', 'tutorial_2012-06-27_11-27-53_w_uuid.xml')
        xml_file = django_file(
            xml_file_path, field_name="xml_file", content_type="text/xml")
        media_files = []
        date_created = datetime.strptime("2013-01-01 12:00:00",
                                         "%Y-%m-%d %H:%M:%S")
        instance = create_instance(
            self.user.username, xml_file, media_files,
            date_created_override=date_created)
        self.assertIsNotNone(instance)
        self.assertEqual(instance.date_created.strftime("%Y-%m-%d %H:%M:%S"),
                         date_created.strftime("%Y-%m-%d %H:%M:%S"))

    def test_date_created_from_filename(self):
        date_str = "2012-01-02-12-35-48"
        date_created = datetime.strptime(date_str, "%Y-%m-%d-%H-%M-%S")
        filename = "%s.xml" % date_str
        generated_date_created = _date_created_from_filename(filename)
        self.assertEqual(generated_date_created, date_created)
        # test a filename with an index suffix
        filename = "%s-%d.xml" % (date_str, 1)
        generated_date_created = _date_created_from_filename(filename)
        self.assertEqual(generated_date_created, date_created)

    def test_backup_then_restore_from_zip(self):
        self._publish_transportation_form()
        initial_instance_count = Instance.objects.filter(
            xform=self.xform).count()

        # make submissions
        for i in range(len(self.surveys)):
            self._submit_transport_instance(i)

        instance_count = Instance.objects.filter(
            xform=self.xform).count()
        self.assertEqual(
            instance_count, initial_instance_count + len(self.surveys))

        # make a backup
        temp_dir = tempfile.mkdtemp()
        zip_file = open(os.path.join(temp_dir, "backup.zip"), "wb")
        zip_file.close()
        create_zip_backup(zip_file.name, self.user, self.xform)

        # delete all the instances
        for instance in Instance.objects.filter(xform=self.xform):
            instance.delete()

        instance_count = Instance.objects.filter(
            xform=self.xform).count()
        # remove temp dir tree
        self.assertEqual(instance_count, 0)

        # restore instances
        self.assertTrue(os.path.exists(zip_file.name))
        restore_backup_from_zip(
            zip_file.name, self.user.username)
        instance_count = Instance.objects.filter(
            xform=self.xform).count()
        # remove temp dir tree
        self.assertEqual(instance_count, len(self.surveys))
        shutil.rmtree(temp_dir)
