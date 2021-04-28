# -*- coding: utf-8 -*-
"""
Some tests for the new (v0.9) spec is properly implemented.
"""
import codecs
import os

import unittest2 as unittest

import pyxform
from pyxform.errors import PyXFormError
from pyxform.tests.utils import XFormTestCase
from pyxform.utils import has_external_choices
from pyxform.xls2json import SurveyReader, parse_file_to_workbook_dict
from pyxform.xls2json_backends import xls_to_dict

DIR = os.path.dirname(__file__)


class GroupNames(unittest.TestCase):
    maxDiff = None

    def runTest(self):
        filename = "group_name_test.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".xml")
        # Do the conversion:
        warnings = []
        with self.assertRaises(Exception):
            json_survey = pyxform.xls2json.parse_file_to_json(
                path_to_excel_file, warnings=warnings
            )
            survey = pyxform.create_survey_element_from_dict(json_survey)
            survey.print_xform_to_file(output_path, warnings=warnings)


class NotClosedGroup(unittest.TestCase):
    maxDiff = None

    def runTest(self):
        filename = "not_closed_group_test.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".xml")
        # Do the conversion:
        warnings = []
        with self.assertRaises(Exception):
            json_survey = pyxform.xls2json.parse_file_to_json(
                path_to_excel_file, warnings=warnings
            )
            survey = pyxform.create_survey_element_from_dict(json_survey)
            survey.print_xform_to_file(output_path, warnings=warnings)


class DuplicateColumns(unittest.TestCase):
    maxDiff = None

    def runTest(self):
        filename = "duplicate_columns.xlsx"
        path_to_excel_file = os.path.join(DIR, "example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".xml")
        # Do the conversion:
        warnings = []
        with self.assertRaises(Exception):
            json_survey = pyxform.xls2json.parse_file_to_json(
                path_to_excel_file, warnings=warnings
            )
            survey = pyxform.create_survey_element_from_dict(json_survey)
            survey.print_xform_to_file(output_path, warnings=warnings)


class RepeatDateTest(XFormTestCase):
    maxDiff = None

    def runTest(self):
        filename = "repeat_date_test.xls"
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


class XmlEscaping(XFormTestCase):
    maxDiff = None

    def runTest(self):
        filename = "xml_escaping.xls"
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


class DefaultTimeTest(XFormTestCase):
    maxDiff = None

    def runTest(self):
        filename = "default_time_demo.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".xml")
        expected_output_path = os.path.join(
            DIR, "test_expected_output", root_filename + ".xml"
        )
        # Do the conversion:
        warnings = []
        json_survey = pyxform.xls2json.parse_file_to_json(
            path_to_excel_file, warnings=warnings
        )
        survey = pyxform.create_survey_element_from_dict(json_survey)
        survey.print_xform_to_file(output_path, warnings=warnings)
        # print warnings
        # Compare with the expected output:
        with codecs.open(expected_output_path, "rb", encoding="utf-8") as expected_file:
            with codecs.open(output_path, "rb", encoding="utf-8") as actual_file:
                self.assertXFormEqual(expected_file.read(), actual_file.read())


class CascadeOldFormat(unittest.TestCase):
    maxDiff = None

    def runTest(self):
        filename = "cascades_old.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".xml")
        # Do the conversion:
        warnings = []
        json_survey = pyxform.xls2json.parse_file_to_json(
            path_to_excel_file, warnings=warnings
        )
        survey = pyxform.create_survey_element_from_dict(json_survey)
        survey.print_xform_to_file(output_path, warnings=warnings)


class ValidateWrapper(unittest.TestCase):
    maxDiff = None

    def runTest(self):
        filename = "ODKValidateWarnings.xlsx"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".xml")
        # Do the conversion:
        warnings = []
        json_survey = pyxform.xls2json.parse_file_to_json(
            path_to_excel_file, warnings=warnings
        )
        survey = pyxform.create_survey_element_from_dict(json_survey)
        survey.print_xform_to_file(output_path, warnings=warnings)


class CascadeOldFormatIndexError(unittest.TestCase):
    maxDiff = None

    def runTest(self):
        filename = "cascades_old_with_no_cascade_sheet.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".xml")
        # Do the conversion:
        warnings = []
        with self.assertRaises(PyXFormError):
            json_survey = pyxform.xls2json.parse_file_to_json(
                path_to_excel_file, warnings=warnings
            )
            survey = pyxform.create_survey_element_from_dict(json_survey)
            survey.print_xform_to_file(output_path, warnings=warnings)


class EmptyStringOnRelevantColumnTest(unittest.TestCase):
    def runTest(self):
        filename = "ict_survey_fails.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        workbook_dict = pyxform.xls2json.parse_file_to_workbook_dict(path_to_excel_file)
        with self.assertRaises(KeyError):
            # bind:relevant should not be part of workbook_dict
            workbook_dict["survey"][0]["bind: relevant"].strip()


class BadChoicesSheetHeaders(unittest.TestCase):
    def runTest(self):
        filename = "spaces_in_choices_header.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        warnings = []
        pyxform.xls2json.parse_file_to_json(path_to_excel_file, warnings=warnings)
        self.assertEquals(len(warnings), 3, "Found " + str(len(warnings)) + " warnings")

    def test_values_with_spaces_are_cleaned(self):
        """
        Test that values with leading and trailing whitespaces are processed.
    
        This test checks that the submission_url provided is cleaned
        of leading and trailing whitespaces.
        """
        filename = "spaces_in_choices_header.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        survey_reader = SurveyReader(path_to_excel_file)
        result = survey_reader.to_json_dict()

        self.assertEqual(
            result["submission_url"], "https://odk.ona.io/random_person/submission"
        )


class TestChoiceNameAsType(unittest.TestCase):
    def test_choice_name_as_type(self):
        filename = "choice_name_as_type.xls"
        path_to_excel_file = os.path.join(DIR, "example_xls", filename)
        xls_reader = SurveyReader(path_to_excel_file)
        survey_dict = xls_reader.to_json_dict()
        self.assertTrue(has_external_choices(survey_dict))


class TestBlankSecondRow(unittest.TestCase):
    def test_blank_second_row(self):
        filename = "blank_second_row.xls"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        xls_reader = SurveyReader(path_to_excel_file)
        survey_dict = xls_reader.to_json_dict()
        self.assertTrue(len(survey_dict) > 0)


class TestXLDateAmbigous(unittest.TestCase):
    """Test non standard sheet with exception is processed successfully."""

    def test_xl_date_ambigous(self):
        """Test non standard sheet with exception is processed successfully."""
        filename = "xl_date_ambiguous.xlsx"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        xls_reader = SurveyReader(path_to_excel_file)
        survey_dict = xls_reader.to_json_dict()
        self.assertTrue(len(survey_dict) > 0)


class TestXLDateAmbigousWithException(unittest.TestCase):
    """Test non standard sheet date values to raise an exception.
        This exception is raised if the date values exceed the
        datemode value accepted by that workbook."""

    def test_xl_date_ambigous_with_exception(self):
        """Test non standard sheet with exception is processed successfully."""
        filename = "xl_date_ambiguous_v1.xlsx"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        with self.assertRaises(PyXFormError) as e:
            xls_to_dict(path_to_excel_file)
        msg = (
            "The xls file provided has an invalid date on the"
            " survey sheet, under the default column on row number 5"
        )

        self.assertEqual(msg, str(e.exception))


class TestSpreadSheetFilesWithMacrosAreAllowed(unittest.TestCase):
    """Test that spreadsheets with .xlsm extension are allowed"""

    def test_xlsm_files_are_allowed(self):
        filename = "excel_with_macros.xlsm"
        path_to_excel_file = os.path.join(DIR, "bug_example_xls", filename)
        result = parse_file_to_workbook_dict(path_to_excel_file)
        self.assertIsInstance(result, dict)


if __name__ == "__main__":
    unittest.main()
