# -*- coding: utf-8 -*-
"""
Some tests for the new (v0.9) spec is properly implemented.
"""
import codecs
import os

import unittest2 as unittest

import pyxform
from pyxform.tests.utils import XFormTestCase

DIR = os.path.dirname(__file__)


class MainTest(XFormTestCase):
    maxDiff = None

    def runTest(self):
        filename = "or_other.xlsx"
        self.get_file_path(filename)
        expected_output_path = os.path.join(
            DIR, "test_expected_output", self.root_filename + ".xml"
        )

        # Do the conversion:
        warnings = []
        json_survey = pyxform.xls2json.parse_file_to_json(
            self.path_to_excel_file, warnings=warnings
        )
        survey = pyxform.create_survey_element_from_dict(json_survey)
        survey.print_xform_to_file(self.output_path, warnings=warnings)
        # print warnings
        # Compare with the expected output:
        with codecs.open(expected_output_path, "rb", encoding="utf-8") as expected_file:
            with codecs.open(self.output_path, "rb", encoding="utf-8") as actual_file:
                self.assertXFormEqual(expected_file.read(), actual_file.read())


if __name__ == "__main__":
    unittest.main()
