# -*- coding: utf-8 -*-
"""
Test cascading select syntax.
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
        for filename in [
            "new_cascading_select.xls",
            "old_cascades.xls",
            "cascading_select_test.xls",
        ]:
            self.get_file_path(filename)
            expected_output_path = os.path.join(
                DIR, "test_expected_output", self.root_filename + ".xml"
            )

            # Do the conversion:
            json_survey = pyxform.xls2json.parse_file_to_json(self.path_to_excel_file)

            survey = pyxform.create_survey_element_from_dict(json_survey)

            survey.print_xform_to_file(self.output_path)

            # Compare with the expected output:
            with codecs.open(
                expected_output_path, "rb", encoding="utf-8"
            ) as expected_file:
                with codecs.open(
                    self.output_path, "rb", encoding="utf-8"
                ) as actual_file:
                    self.assertXFormEqual(expected_file.read(), actual_file.read())


if __name__ == "__main__":
    unittest.main()
