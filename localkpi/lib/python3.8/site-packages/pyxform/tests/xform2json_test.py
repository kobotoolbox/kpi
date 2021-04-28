# -*- coding: utf-8 -*-
"""
Test xform2json module.
"""
import os
from xml.etree.ElementTree import ParseError

from unittest2 import TestCase

from pyxform.builder import create_survey_from_path
from pyxform.tests import utils
from pyxform.xform2json import _try_parse, create_survey_element_from_xml


class DumpAndLoadXForm2JsonTests(utils.XFormTestCase):

    maxDiff = None

    def setUp(self):
        self.excel_files = [
            "gps.xls",
            # "include.xls",
            "specify_other.xls",
            "loop.xls",
            "text_and_integer.xls",
            # todo: this is looking for json that is created (and
            # deleted) by another test, is should just add that json
            # to the directory.
            # "include_json.xls",
            "simple_loop.xls",
            "yes_or_no_question.xls",
            "xlsform_spec_test.xlsx",
            "group.xls",
        ]
        self.surveys = {}
        self.this_directory = os.path.dirname(__file__)
        for filename in self.excel_files:
            path = utils.path_to_text_fixture(filename)
            self.surveys[filename] = create_survey_from_path(path)

    def test_load_from_dump(self):
        for filename, survey in iter(self.surveys.items()):
            survey.json_dump()
            survey_from_dump = create_survey_element_from_xml(survey.to_xml())
            self.assertXFormEqual(survey.to_xml(), survey_from_dump.to_xml())

    def tearDown(self):
        for filename, survey in self.surveys.items():
            path = survey.name + ".json"
            if os.path.exists(path):
                os.remove(path)


class TestXMLParse(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cwd = os.path.dirname(__file__)
        cls.tidy_file = None
        cls.xml = """<?xml version="1.0"?>\n<a><b>1</b></a>"""

    def tearDown(self):
        if self.tidy_file is not None:
            os.remove(self.tidy_file)

    def test_try_parse_with_string(self):
        """Should return root node from XML string."""
        root = _try_parse(self.xml)
        self.assertEqual("a", root.tag)

    def test_try_parse_with_path(self):
        """Should return root node from XML file path."""
        xml_path = os.path.join(self.cwd, "test_try_parse.xml")
        self.tidy_file = xml_path
        with open(xml_path, "w") as xml_file:
            xml_file.write(self.xml)
        root = _try_parse(xml_path)
        self.assertEqual("a", root.tag)

    def test_try_parse_with_bad_path(self):
        """Should raise IOError: file doesn't exist."""
        xml_path = os.path.join(self.cwd, "not_a_real_file.xyz")
        with self.assertRaises(IOError):
            _try_parse(xml_path)

    def test_try_parse_with_bad_string(self):
        """Should raise IOError: string parse failed and its not a path."""
        with self.assertRaises(IOError):
            _try_parse("not valid xml :(")

    def test_try_parse_with_bad_file(self):
        """Should raise XMLSyntaxError: file exists but content is not valid."""
        xml_path = os.path.join(self.cwd, "test_try_parse.xml")
        self.tidy_file = xml_path
        with open(xml_path, "w") as xml_file:
            xml_file.write("not valid xml :(")
        with self.assertRaises(ParseError):
            _try_parse(xml_path)
