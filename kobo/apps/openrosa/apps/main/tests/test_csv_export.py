# coding: utf-8
import os

from django.utils.dateparse import parse_datetime

from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary
from kobo.apps.openrosa.apps.viewer.models.export import Export
from kobo.apps.openrosa.libs.utils.export_tools import generate_export
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from .test_base import TestBase


class TestExport(TestBase):

    def setUp(self):
        self._create_user_and_login()
        self.fixture_dir = os.path.join(
            self.this_directory, 'fixtures', 'csv_export')
        self._submission_time = parse_datetime('2013-02-18 15:54:01Z')

    def test_csv_export_output(self):
        path = os.path.join(self.fixture_dir, 'tutorial_w_repeats.xls')
        self._publish_xls_file_and_set_xform(path)
        path = os.path.join(self.fixture_dir, 'tutorial_w_repeats.xml')
        self._make_submission(
            path, forced_submission_time=self._submission_time)
        # test csv
        export = generate_export(Export.CSV_EXPORT, 'csv', self.user.username,
                                 'tutorial_w_repeats')

        self.assertTrue(default_storage.exists(export.filepath))
        path, ext = os.path.splitext(export.filename)
        self.assertEqual(ext, '.csv')
        with open(os.path.join(
                self.fixture_dir, 'tutorial_w_repeats.csv'), 'rb') as f1:
            with default_storage.open(export.filepath) as f2:
                expected_content = f1.read()
                actual_content = f2.read()
                self.assertEqual(actual_content, expected_content)

    def test_csv_nested_repeat_output(self):
        path = os.path.join(self.fixture_dir, 'double_repeat.xls')
        self._publish_xls_file(path)
        path = os.path.join(self.fixture_dir, 'instance.xml')
        self._make_submission(
            path, forced_submission_time=self._submission_time)
        self.maxDiff = None
        dd = DataDictionary.objects.all()[0]
        xpaths = [
            '/double_repeat/bed_net[1]/member[1]/name',
            '/double_repeat/bed_net[1]/member[2]/name',
            '/double_repeat/bed_net[2]/member[1]/name',
            '/double_repeat/bed_net[2]/member[2]/name',
            '/double_repeat/meta/instanceID'
        ]
        self.assertEqual(dd.xpaths(repeat_iterations=2), xpaths)
        # test csv
        export = generate_export(Export.CSV_EXPORT, 'csv', self.user.username,
                                 'double_repeat')

        self.assertTrue(default_storage.exists(export.filepath))
        path, ext = os.path.splitext(export.filename)
        self.assertEqual(ext, '.csv')
        with open(os.path.join(self.fixture_dir, 'export.csv'), 'rb') as f1:
            with default_storage.open(export.filepath) as f2:
                expected_content = f1.read()
                actual_content = f2.read()
                self.assertEqual(actual_content, expected_content)

    def test_dotted_fields_csv_export_output(self):
        path = os.path.join(
            os.path.dirname(__file__),
            'fixtures',
            'userone',
            'userone_with_dot_name_fields.xls',
        )
        self._publish_xls_file_and_set_xform(path)
        path = os.path.join(
            os.path.dirname(__file__),
            'fixtures',
            'userone',
            'userone_with_dot_name_fields.xml',
        )
        self._make_submission(
            path, forced_submission_time=self._submission_time
        )
        # test csv
        export = generate_export(
            Export.CSV_EXPORT,
            'csv',
            self.user.username,
            'userone_with_dot_name_fields',
        )
        self.assertTrue(default_storage.exists(export.filepath))
        path, ext = os.path.splitext(export.filename)
        self.assertEqual(ext, '.csv')
        with open(
            os.path.join(
                os.path.dirname(__file__),
                'fixtures',
                'userone',
                'userone_with_dot_name_fields.csv',
            ),
            'rb',
        ) as f1:
            with default_storage.open(export.filepath) as f2:
                expected_content = f1.read()
                actual_content = f2.read()
                self.assertEqual(actual_content, expected_content)
