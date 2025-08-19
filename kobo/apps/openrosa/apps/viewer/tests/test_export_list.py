# coding: utf-8
import os
import unittest

from django.urls import reverse

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.viewer.models.export import Export
from kobo.apps.openrosa.apps.viewer.views import export_list


class TestExportList(TestBase):

    def setUp(self):
        super().setUp()
        self._publish_transportation_form()
        survey = self.surveys[0]
        self._make_submission(
            os.path.join(
                self.this_directory, 'fixtures', 'transportation',
                'instances', survey, survey + '.xml'))

    def test_unauthorised_users_cannot_export_form_data(self):
        kwargs = {'username': self.user.username,
                  'id_string': self.xform.id_string,
                  'export_type': Export.CSV_EXPORT}

        url = reverse(export_list, kwargs=kwargs)
        response = self.client.get(url)

        # check that the 'New Export' button is not being rendered
        self.assertNotIn(
            '<input title="" data-original-title="" \
            class="btn large btn-primary" \
            value="New Export" type="submit">', response.content.decode())
        self.assertEqual(response.status_code, 200)

    @unittest.skip('Fails under Django 1.6')
    def test_csv_export_list(self):
        kwargs = {'username': self.user.username.upper(),
                  'id_string': self.xform.id_string.upper(),
                  'export_type': Export.CSV_EXPORT}

        # test csv
        url = reverse(export_list, kwargs=kwargs)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_xls_export_list(self):
        kwargs = {'username': self.user.username,
                  'id_string': self.xform.id_string,
                  'export_type': Export.XLS_EXPORT}
        url = reverse(export_list, kwargs=kwargs)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_kml_export_list(self):
        kwargs = {'username': self.user.username,
                  'id_string': self.xform.id_string,
                  'export_type': Export.KML_EXPORT}
        url = reverse(export_list, kwargs=kwargs)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_zip_export_list(self):
        kwargs = {'username': self.user.username,
                  'id_string': self.xform.id_string,
                  'export_type': Export.ZIP_EXPORT}
        url = reverse(export_list, kwargs=kwargs)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
