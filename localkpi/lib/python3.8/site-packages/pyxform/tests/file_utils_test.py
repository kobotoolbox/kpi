# -*- coding: utf-8 -*-
"""
Test xls2json_backends util functions.
"""
from unittest import TestCase

from pyxform.tests import utils
from pyxform.xls2json_backends import convert_file_to_csv_string


class BackendUtilsTests(TestCase):
    def test_xls_to_csv(self):
        specify_other_xls = utils.path_to_text_fixture("specify_other.xls")
        converted_xls = convert_file_to_csv_string(specify_other_xls)
        specify_other_csv = utils.path_to_text_fixture("specify_other.csv")
        converted_csv = convert_file_to_csv_string(specify_other_csv)
        self.assertEqual(converted_csv, converted_xls)
