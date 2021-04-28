# -*- coding: utf-8 -*-
"""
Test file question type.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class FileWidgetTest(PyxformTestCase):
    """
    Test file widget class.
    """

    def test_file_type(self):
        """
        Test file question type.
        """
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |        |               |
            |        | type   | name   | label         |
            |        | file   | file   | Attach a file |
            """,
            xml__contains=['<upload mediatype="application/*"'],
        )
