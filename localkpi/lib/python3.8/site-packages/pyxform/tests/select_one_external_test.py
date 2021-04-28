# -*- coding: utf-8 -*-
"""
Test select one external syntax.
"""
import codecs
import os

import unittest2 as unittest

import pyxform
from pyxform.tests import utils
from pyxform.tests.utils import XFormTestCase
from pyxform.utils import sheet_to_csv
from pyxform import InputQuestion, Survey

DIR = os.path.dirname(__file__)


class MainTest(XFormTestCase):

    maxDiff = None

    def runTest(self):
        for filename in ["select_one_external.xlsx"]:
            self.get_file_path(filename)
            expected_output_path = os.path.join(
                DIR, "test_expected_output", self.root_filename + ".xml"
            )

            output_csv = os.path.join(DIR, "test_output", self.root_filename + ".csv")
            # Do the conversion:
            json_survey = pyxform.xls2json.parse_file_to_json(self.path_to_excel_file)

            self.assertTrue(
                sheet_to_csv(self.path_to_excel_file, output_csv, "external_choices")
            )
            self.assertFalse(
                sheet_to_csv(self.path_to_excel_file, output_csv, "non-existant sheet")
            )

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

    def test_csv_data(self):
        """
        Test that the data on the external choices sheet is cleaned and written
        appropriately to the csv file.
        """

        filename = "select_one_external.xlsx"
        self.get_file_path(filename)

        output_csv = os.path.join(DIR, "test_output", self.root_filename + ".csv")

        self.assertTrue(
            sheet_to_csv(self.path_to_excel_file, output_csv, "external_choices")
        )

        # Compare with the expected output
        with codecs.open(output_csv, "rb", encoding="utf-8") as expected_file:
            rows = expected_file.read()
            # Evaluate the last line obtained from the csv file
            self.assertEqual(
                rows.splitlines()[-1],
                '"cities","puyallup","Puyallup","washington","pierce"',
            )
            # Evaluate the first line obtained from the csv file
            self.assertEqual(
                rows.splitlines()[0], '"list_name","name","label","state","county"'
            )

    def test_output_node_for_select_one_question_type(self):

        self.this_directory = os.path.dirname(__file__)
        survey_out = Survey(name="geopgraphy", sms_keyword="geography", type="survey")
        question = InputQuestion(name="counties")
        question.type = "select one external"
        question.label = "county"
        survey_out.add_child(question)

        expected = '<input ref="/geopgraphy/counties">'

        xml = survey_out.to_xml()
        self.assertEqual(1, xml.count(expected))


if __name__ == "__main__":
    unittest.main()
