# -*- coding: utf-8 -*-
"""
Test xls2json_backends module functionality.
"""
from unittest import TestCase

import xlrd

from pyxform.xls2json_backends import xls_value_to_unicode


class TestXLS2JSONBackends(TestCase):
    """
    Test xls2json_backends module.
    """

    def test_xls_value_to_unicode(self):
        """
        Test external choices sheet with numeric values is processed successfully.

        The test ensures that the integer values within the external choices sheet
        are returned as they were initially received.
        """
        value = 32.0
        value_type = xlrd.XL_CELL_NUMBER
        datemode = 1
        csv_data = xls_value_to_unicode(value, value_type, datemode)
        expected_output = "32"
        self.assertEqual(csv_data, expected_output)

        # Test that the decimal value is not changed during conversion.
        value = 46.9
        csv_data = xls_value_to_unicode(value, value_type, datemode)
        expected_output = "46.9"
        self.assertEqual(csv_data, expected_output)
