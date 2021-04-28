# -*- coding: utf-8 -*-
"""
Test multiple XLSForm can be generated successfully.
"""
import os
from unittest import TestCase

from pyxform.builder import create_survey_from_path
from pyxform.tests import utils


class DumpAndLoadTests(TestCase):
    def setUp(self):
        self.excel_files = [
            "gps.xls",
            # "include.xls",
            "specify_other.xls",
            "group.xls",
            "loop.xls",
            "text_and_integer.xls",
            # todo: this is looking for json that is created (and
            # deleted) by another test, is should just add that json
            # to the directory.
            # "include_json.xls",
            "simple_loop.xls",
            "yes_or_no_question.xls",
        ]
        self.surveys = {}
        self.this_directory = os.path.dirname(__file__)
        for filename in self.excel_files:
            path = utils.path_to_text_fixture(filename)
            self.surveys[filename] = create_survey_from_path(path)

    def test_load_from_dump(self):
        for filename, survey in self.surveys.items():
            survey.json_dump()
            path = survey.name + ".json"
            survey_from_dump = create_survey_from_path(path)
            self.assertEqual(survey.to_json_dict(), survey_from_dump.to_json_dict())

    def tearDown(self):
        for filename, survey in self.surveys.items():
            path = survey.name + ".json"
            os.remove(path)
