# coding: utf-8
import os
import sys
import unittest

import pytest
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from pyxform.errors import PyXFormError

from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.utils.logger_tools import report_exception


class TestPublishXLS(TestBase):

    def test_publish_xls(self):
        xls_file_path = os.path.join(
            self.this_directory, 'fixtures', 'transportation', 'transportation.xls'
        )
        count = XForm.objects.count()
        call_command('publish_xls', xls_file_path, self.user.username)
        self.assertEqual(XForm.objects.count(), count + 1)
        form = XForm.objects.get()
        self.assertTrue(form.require_auth)

    def test_publish_xls_replacement(self):
        count = XForm.objects.count()
        xls_file_path = os.path.join(
            self.this_directory, 'fixtures', 'transportation', 'transportation.xls'
        )
        call_command('publish_xls', xls_file_path, self.user.username)
        self.assertEqual(XForm.objects.count(), count + 1)
        count = XForm.objects.count()
        xls_file_path = os.path.join(
            self.this_directory,
            'fixtures',
            'transportation',
            'transportation_updated.xls',
        )
        # call command without replace param
        with self.assertRaises(CommandError):
            call_command('publish_xls', xls_file_path, self.user.username)
        # now we call the command with the replace param
        call_command(
            'publish_xls', xls_file_path, self.user.username, replace=True)
        # count should remain the same
        self.assertEqual(XForm.objects.count(), count)
        # check if the extra field has been added
        self.xform = XForm.objects.order_by('id').reverse()[0]
        data_dictionary = self.xform.data_dictionary()
        is_updated_form = len([e.name for e in data_dictionary.survey_elements
                               if e.name == 'preferred_means']) > 0
        self.assertTrue(is_updated_form)

    @unittest.skip('Fails under Django 1.6')
    def test_line_break_in_variables(self):
        xls_file_path = os.path.join(
            self.this_directory, 'fixtures', 'exp_line_break.xlsx'
        )
        xml_file_path = os.path.join(
            self.this_directory, 'fixtures', 'exp_line_break.xml'
        )
        test_xml_file_path = os.path.join(
            self.this_directory, 'fixtures', 'test_exp_line_break.xml'
        )
        self._publish_xls_file(xls_file_path)
        xforms = XForm.objects.filter(id_string='exp_line_break')
        self.assertTrue(xforms.count() > 0)
        xform = xforms[0]
        xform.xml = xform.xml.replace(
            xform.uuid, '663123a849e54bffa8f9832ef016bfac')
        xform.save()
        f = open(test_xml_file_path, 'wb')
        f.write(xform.xml)
        f.close()
        with open(xml_file_path, 'rb') as expected_file:
            with open(test_xml_file_path, 'rb') as actual_file:
                self.assertMultiLineEqual(
                    expected_file.read().decode(), actual_file.read().decode())
        os.remove(test_xml_file_path)

    def test_report_exception_with_exc_info(self):
        e = Exception('A test exception')
        try:
            raise e
        except Exception as e:
            exc_info = sys.exc_info()
            try:
                report_exception(
                    subject='Test report exception', info=e, exc_info=exc_info
                )
            except Exception as e:
                raise AssertionError('%s' % e)

    def test_report_exception_without_exc_info(self):
        e = Exception('A test exception')
        try:
            report_exception(subject='Test report exception', info=e)
        except Exception as e:
            raise AssertionError('%s' % e)

    def test_publish_invalid_xls_form(self):
        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation.bad_id.xls',
        )

        with pytest.raises(PyXFormError) as e:
            self._publish_xls_file(path)
        assert '[row : 5] Question or group with no name.' in str(e)

    def test_publish_invalid_xls_form_no_choices(self):
        path = os.path.join(
            settings.OPENROSA_APP_DIR,
            'apps',
            'main',
            'tests',
            'fixtures',
            'transportation',
            'transportation.no_choices.xls',
        )

        with pytest.raises(PyXFormError) as e:
            self._publish_xls_file(path)

        # Intermediate variable `columns` is just here to lure linter about Q000
        columns = "'list_name', 'name', and 'label'"
        error_msg = (
            f'There should be a choices sheet in this xlsform. '
            f'Please ensure that the choices sheet has the mandatory '
            f'columns {columns}.'
        )
        assert error_msg in str(e)
