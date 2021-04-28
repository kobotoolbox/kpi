# -*- coding: utf-8 -*-
"""
Testing simple cases for Xls2Json
"""
import codecs
import json
import os

from unittest2 import TestCase

from pyxform.tests import utils
from pyxform.xls2json import SurveyReader, parse_file_to_json
from pyxform.xls2json_backends import csv_to_dict, xls_to_dict


# Nothing calls this AFAICT
def absolute_path(f, file_name):
    directory = os.path.dirname(f)
    return os.path.join(directory, file_name)


DIR = os.path.dirname(__file__)


class BasicXls2JsonApiTests(TestCase):
    maxDiff = None

    def test_simple_yes_or_no_question(self):
        filename = "yes_or_no_question.xls"
        path_to_excel_file = os.path.join(DIR, "example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".json")
        expected_output_path = os.path.join(
            DIR, "test_expected_output", root_filename + ".json"
        )
        x = SurveyReader(path_to_excel_file)
        x_results = x.to_json_dict()
        with codecs.open(output_path, mode="w", encoding="utf-8") as fp:
            json.dump(x_results, fp=fp, ensure_ascii=False, indent=4)
        # Compare with the expected output:
        with codecs.open(expected_output_path, "rb", encoding="utf-8") as expected_file:
            with codecs.open(output_path, "rb", encoding="utf-8") as actual_file:
                expected_json = json.load(expected_file)
                actual_json = json.load(actual_file)
                self.assertEqual(expected_json, actual_json)

    def test_hidden(self):
        x = SurveyReader(utils.path_to_text_fixture("hidden.xls"))
        x_results = x.to_json_dict()

        expected_dict = [
            {"type": "hidden", "name": "hidden_test"},
            {
                "children": [
                    {
                        "bind": {"jr:preload": "uid", "readonly": "true()"},
                        "name": "instanceID",
                        "type": "calculate",
                    }
                ],
                "control": {"bodyless": True},
                "name": "meta",
                "type": "group",
            },
        ]
        self.assertEqual(x_results["children"], expected_dict)

    def test_gps(self):
        x = SurveyReader(utils.path_to_text_fixture("gps.xls"))

        expected_dict = [
            {"type": "gps", "name": "location", "label": "GPS"},
            {
                "children": [
                    {
                        "bind": {"jr:preload": "uid", "readonly": "true()"},
                        "name": "instanceID",
                        "type": "calculate",
                    }
                ],
                "control": {"bodyless": True},
                "name": "meta",
                "type": "group",
            },
        ]

        self.assertEqual(x.to_json_dict()["children"], expected_dict)

    def test_text_and_integer(self):
        x = SurveyReader(utils.path_to_text_fixture("text_and_integer.xls"))

        expected_dict = [
            {
                "label": {"english": "What is your name?"},
                "type": "text",
                "name": "your_name",
            },
            {
                "label": {"english": "How many years old are you?"},
                "type": "integer",
                "name": "your_age",
            },
            {
                "children": [
                    {
                        "bind": {"jr:preload": "uid", "readonly": "true()"},
                        "name": "instanceID",
                        "type": "calculate",
                    }
                ],
                "control": {"bodyless": True},
                "name": "meta",
                "type": "group",
            },
        ]

        self.assertEqual(x.to_json_dict()["children"], expected_dict)

    def test_table(self):
        filename = "simple_loop.xls"
        path_to_excel_file = os.path.join(DIR, "example_xls", filename)
        # Get the xform output path:
        root_filename, ext = os.path.splitext(filename)
        output_path = os.path.join(DIR, "test_output", root_filename + ".json")
        expected_output_path = os.path.join(
            DIR, "test_expected_output", root_filename + ".json"
        )
        x = SurveyReader(path_to_excel_file)
        x_results = x.to_json_dict()
        with codecs.open(output_path, mode="w", encoding="utf-8") as fp:
            json.dump(x_results, fp=fp, ensure_ascii=False, indent=4)
        # Compare with the expected output:
        with codecs.open(expected_output_path, "rb", encoding="utf-8") as expected_file:
            with codecs.open(output_path, "rb", encoding="utf-8") as actual_file:
                expected_json = json.load(expected_file)
                actual_json = json.load(actual_file)
                self.assertEqual(expected_json, actual_json)

    def test_choice_filter_choice_fields(self):
        """
        Test that the choice filter fields appear on children field of json
        """
        choice_filter_survey = SurveyReader(
            utils.path_to_text_fixture("choice_filter_test.xlsx")
        )

        expected_dict = [
            {
                "choices": [
                    {"name": "texas", "label": "Texas"},
                    {"name": "washington", "label": "Washington"},
                ],
                "type": "select one",
                "name": "state",
                "parameters": {},
                "label": "state",
            },
            {
                "name": "county",
                "parameters": {},
                "choice_filter": "${state}=cf",
                "label": "county",
                "itemset": "counties",
                "choices": [
                    {"label": "King", "cf": "washington", "name": "king"},
                    {"label": "Pierce", "cf": "washington", "name": "pierce"},
                    {"label": "King", "cf": "texas", "name": "king"},
                    {"label": "Cameron", "cf": "texas", "name": "cameron"},
                ],
                "type": "select one",
            },
            {
                "name": "city",
                "parameters": {},
                "choice_filter": "${county}=cf",
                "label": "city",
                "itemset": "cities",
                "choices": [
                    {"label": "Dumont", "cf": "king", "name": "dumont"},
                    {"label": "Finney", "cf": "king", "name": "finney"},
                    {"label": "brownsville", "cf": "cameron", "name": "brownsville"},
                    {"label": "harlingen", "cf": "cameron", "name": "harlingen"},
                    {"label": "Seattle", "cf": "king", "name": "seattle"},
                    {"label": "Redmond", "cf": "king", "name": "redmond"},
                    {"label": "Tacoma", "cf": "pierce", "name": "tacoma"},
                    {"label": "Puyallup", "cf": "pierce", "name": "puyallup"},
                ],
                "type": "select one",
            },
            {
                "control": {"bodyless": True},
                "type": "group",
                "name": "meta",
                "children": [
                    {
                        "bind": {"readonly": "true()", "jr:preload": "uid"},
                        "type": "calculate",
                        "name": "instanceID",
                    }
                ],
            },
        ]
        self.assertEqual(choice_filter_survey.to_json_dict()["children"], expected_dict)


class CsvReaderEquivalencyTest(TestCase):
    def test_equivalency(self):
        equivalent_fixtures = [
            "group",
            "loop",  # 'gps',
            "specify_other",
            "include",
            "text_and_integer",
            "include_json",
            "yes_or_no_question",
        ]
        for fixture in equivalent_fixtures:
            xls_path = utils.path_to_text_fixture("%s.xls" % fixture)
            csv_path = utils.path_to_text_fixture("%s.csv" % fixture)
            xls_inp = xls_to_dict(xls_path)
            csv_inp = csv_to_dict(csv_path)
            self.maxDiff = None
            self.assertEqual(csv_inp, xls_inp)


class UnicodeCsvTest(TestCase):
    def test_a_unicode_csv_works(self):
        """
        Simply tests that xls2json_backends.csv_to_dict does not have a problem
        with a csv with unicode characters
        """
        utf_csv_path = utils.path_to_text_fixture("utf_csv.csv")
        dict_value = csv_to_dict(utf_csv_path)
        self.assertTrue("\\ud83c" in json.dumps(dict_value))
