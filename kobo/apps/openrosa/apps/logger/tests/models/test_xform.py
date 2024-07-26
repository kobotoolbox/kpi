# coding: utf-8
import os
import reversion
import unittest

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.apps.logger.models import XForm, Instance


class TestXForm(TestBase):
    def test_set_title_in_xml_unicode_error(self):
        xls_file_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "../..",  "fixtures", "tutorial", "tutorial_arabic_labels.xls"
        )
        self._publish_xls_file_and_set_xform(xls_file_path)

        self.assertTrue(isinstance(self.xform.xml, str))

        # change title
        self.xform.title = 'Random Title'

        self.assertNotIn(self.xform.title, self.xform.xml)

        # set title in xform xml
        self.xform._set_title()
        self.assertIn(self.xform.title, self.xform.xml)

    @unittest.skip('Fails under Django 1.6')
    def test_reversion(self):
        self.assertTrue(reversion.is_registered(XForm))
