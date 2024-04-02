# coding: utf-8
import os
from io import StringIO, BytesIO

from django.conf import settings
from django.test import RequestFactory
from django.urls import reverse

from kobo.apps.openrosa.libs.utils import csv_import
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase


class CSVImportTestCase(TestBase):

    def setUp(self):
        super().setUp()
        self.fixtures_dir = os.path.join(
            settings.OPENROSA_APP_DIR, 'libs', 'tests', 'fixtures'
        )
        self.good_csv = open(os.path.join(self.fixtures_dir, 'good.csv'), 'rb')
        self.bad_csv = open(os.path.join(self.fixtures_dir, 'bad.csv'), 'rb')
        xls_file_path = os.path.join(self.fixtures_dir, 'tutorial.xls')
        self._publish_xls_file(xls_file_path)
        self.xform = XForm.objects.get()
        self.request = RequestFactory().post(
            reverse('xform-csv-import', kwargs={'pk': self.xform.pk})
        )
        self.request.user = self.xform.user

    def test_submit_csv_param_sanity_check(self):
        resp = csv_import.submit_csv(self.request, self.xform, 123456)
        self.assertIsNotNone(resp.get('error'))

    # @mock.patch('kobo.apps.openrosa.libs.utils.csv_import.safe_create_instance')
    # def test_submit_csv_xml_params(self, safe_create_instance):
    #     safe_create_instance.return_value = [None, {}]
    #     single_csv = open(os.path.join(self.fixtures_dir, 'single.csv'))
    #     csv_import.submit_csv(self.user.username, self.xform, single_csv)
    #     xml_file_param = StringIO(open(os.path.join(self.fixtures_dir,
    #                                                 'single.csv')).read())
    #     safe_create_instance.assert_called_with(self.user.username,
    #                                             xml_file_param, [],
    #                                             self.xform.uuid, None)

    def test_submit_csv_and_rollback(self):
        count = Instance.objects.count()
        csv_import.submit_csv(self.request, self.xform, self.good_csv)
        self.assertEqual(Instance.objects.count(),
                         count + 9, 'submit_csv test Failed!')
        # CSV imports previously allowed `_submitted_by` to be set arbitrarily;
        # it is now always assigned to the user requesting the CSV import
        self.assertEqual(
            Instance.objects.filter(user=self.user).count(), count + 9
        )

    def test_submit_csv_edits(self):
        csv_import.submit_csv(self.request, self.xform, self.good_csv)
        self.assertEqual(
            Instance.objects.count(), 9, 'submit_csv edits #1 test Failed!'
        )

        edit_csv = open(os.path.join(self.fixtures_dir, 'edit.csv'), 'rb')
        edit_csv_str = edit_csv.read().decode()

        edit_csv = BytesIO(
            edit_csv_str.format(
                *[x.get('uuid') for x in Instance.objects.values('uuid')]
            ).encode()
        )

        count = Instance.objects.count()
        csv_import.submit_csv(self.request, self.xform, edit_csv)
        self.assertEqual(
            Instance.objects.count(), count, 'submit_csv edits #2 test Failed!'
        )
