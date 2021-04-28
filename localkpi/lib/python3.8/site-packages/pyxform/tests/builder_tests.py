# -*- coding: utf-8 -*-
"""
Test builder module functionality.
"""
import os
import re
import xml.etree.ElementTree as ETree
from unittest import TestCase

from pyxform import InputQuestion, Survey
from pyxform.builder import SurveyElementBuilder, create_survey_from_xls
from pyxform.errors import PyXFormError
from pyxform.tests import utils
from pyxform.xls2json import print_pyobj_to_json

FIXTURE_FILETYPE = "xls"


class BuilderTests(TestCase):
    maxDiff = None

    #   Moving to spec tests
    #    def test_new_widgets(self):
    #        survey = utils.build_survey('widgets.xls')
    #        path = utils.path_to_text_fixture('widgets.xml')
    #        survey.to_xml
    #        with open(path) as f:
    #            expected = ETree.fromstring(survey.to_xml())
    #            result = ETree.fromstring(f.read())
    #            self.assertTrue(xml_compare(expected, result))

    def test_unknown_question_type(self):
        survey = utils.build_survey("unknown_question_type.xls")
        self.assertRaises(PyXFormError, survey.to_xml)

    def test_uniqueness_of_section_names(self):
        # Looking at the xls file, I think this test might be broken.
        survey = utils.build_survey("group_names_must_be_unique.xls")
        self.assertRaises(Exception, survey.to_xml)

    def setUp(self):
        self.this_directory = os.path.dirname(__file__)
        survey_out = Survey(name="age", sms_keyword="age", type="survey")
        question = InputQuestion(name="age")
        question.type = "integer"
        question.label = "How old are you?"
        survey_out.add_child(question)
        self.survey_out_dict = survey_out.to_json_dict()
        print_pyobj_to_json(
            self.survey_out_dict, utils.path_to_text_fixture("how_old_are_you.json")
        )

    def test_create_from_file_object(self):
        path = utils.path_to_text_fixture("yes_or_no_question.xls")
        with open(path, "rb") as f:
            create_survey_from_xls(f)

    def tearDown(self):
        fixture_path = utils.path_to_text_fixture("how_old_are_you.json")
        if os.path.exists(fixture_path):
            os.remove(fixture_path)

    def test_create_table_from_dict(self):
        d = {
            "type": "loop",
            "name": "my_loop",
            "label": {"English": "My Loop"},
            "columns": [
                {"name": "col1", "label": {"English": "column 1"}},
                {"name": "col2", "label": {"English": "column 2"}},
            ],
            "children": [
                {
                    "type": "integer",
                    "name": "count",
                    "label": {"English": "How many are there in this group?"},
                }
            ],
        }
        builder = SurveyElementBuilder()
        g = builder.create_survey_element_from_dict(d)

        expected_dict = {
            "name": "my_loop",
            "label": {"English": "My Loop"},
            "type": "group",
            "children": [
                {
                    "name": "col1",
                    "label": {"English": "column 1"},
                    "type": "group",
                    "children": [
                        {
                            "name": "count",
                            "label": {"English": "How many are there in this group?"},
                            "type": "integer",
                        }
                    ],
                },
                {
                    "name": "col2",
                    "label": {"English": "column 2"},
                    "type": "group",
                    "children": [
                        {
                            "name": "count",
                            "label": {"English": "How many are there in this group?"},
                            "type": "integer",
                        }
                    ],
                },
            ],
        }

        self.assertEqual(g.to_json_dict(), expected_dict)

    def test_specify_other(self):
        survey = utils.create_survey_from_fixture(
            "specify_other", filetype=FIXTURE_FILETYPE
        )
        expected_dict = {
            "name": "specify_other",
            "type": "survey",
            "title": "specify_other",
            "default_language": "default",
            "id_string": "specify_other",
            "sms_keyword": "specify_other",
            "children": [
                {
                    "name": "sex",
                    "label": {"English": "What sex are you?"},
                    "type": "select one",
                    "children": [
                        # TODO Change to choices (there is stuff in the
                        # json2xform half that will need to change)
                        {"name": "male", "label": {"English": "Male"}},
                        {"name": "female", "label": {"English": "Female"}},
                        {"name": "other", "label": "Other"},
                    ],
                },
                {
                    "name": "sex_other",
                    "bind": {"relevant": "selected(../sex, 'other')"},
                    "label": "Specify other.",
                    "type": "text",
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
            ],
        }
        self.maxDiff = None
        self.assertEqual(survey.to_json_dict(), expected_dict)

    def test_select_one_question_with_identical_choice_name(self):
        """
        testing to make sure that select ones whose choice names are the same
        as the name of the select one get compiled.
        """
        survey = utils.create_survey_from_fixture(
            "choice_name_same_as_select_name", filetype=FIXTURE_FILETYPE
        )
        expected_dict = {
            "name": "choice_name_same_as_select_name",
            "title": "choice_name_same_as_select_name",
            "sms_keyword": "choice_name_same_as_select_name",
            "default_language": "default",
            "id_string": "choice_name_same_as_select_name",
            "type": "survey",
            "children": [
                {
                    "children": [{"name": "zone", "label": "Zone"}],
                    "type": "select one",
                    "name": "zone",
                    "label": "Zone",
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
            ],
        }
        self.maxDiff = None
        self.assertEqual(survey.to_json_dict(), expected_dict)

    def test_loop(self):
        survey = utils.create_survey_from_fixture("loop", filetype=FIXTURE_FILETYPE)
        expected_dict = {
            "name": "loop",
            "id_string": "loop",
            "sms_keyword": "loop",
            "title": "loop",
            "type": "survey",
            "default_language": "default",
            "children": [
                {
                    "name": "available_toilet_types",
                    "label": {"english": "What type of toilets are on the premises?"},
                    "type": "select all that apply",
                    "children": [
                        {
                            "name": "pit_latrine_with_slab",
                            "label": {"english": "Pit latrine with slab"},
                        },
                        {
                            "name": "open_pit_latrine",
                            "label": {"english": "Pit latrine without slab/open pit"},
                        },
                        {
                            "name": "bucket_system",
                            "label": {"english": "Bucket system"},
                        },
                        # Removing this because select alls shouldn't need
                        # an explicit none option
                        # {
                        #    u'name': u'none',
                        #    u'label': u'None',
                        #    },
                        {"name": "other", "label": "Other"},
                    ],
                },
                {
                    "name": "available_toilet_types_other",
                    "bind": {
                        "relevant": "selected(../available_toilet_types, 'other')"
                    },
                    "label": "Specify other.",
                    "type": "text",
                },
                {
                    "name": "loop_toilet_types",
                    "type": "group",
                    "children": [
                        {
                            "name": "pit_latrine_with_slab",
                            "label": {"english": "Pit latrine with slab"},
                            "type": "group",
                            "children": [
                                {
                                    "name": "number",
                                    "label": {
                                        "english": "How many Pit latrine with slab are"
                                        " on the premises?"
                                    },
                                    "type": "integer",
                                }
                            ],
                        },
                        {
                            "name": "open_pit_latrine",
                            "label": {"english": "Pit latrine without slab/open pit"},
                            "type": "group",
                            "children": [
                                {
                                    "name": "number",
                                    "label": {
                                        "english": "How many Pit latrine without "
                                        "slab/open pit are on the premises?"
                                    },
                                    "type": "integer",
                                }
                            ],
                        },
                        {
                            "name": "bucket_system",
                            "label": {"english": "Bucket system"},
                            "type": "group",
                            "children": [
                                {
                                    "name": "number",
                                    "label": {
                                        "english": "How many Bucket system are on the"
                                        " premises?"
                                    },
                                    "type": "integer",
                                }
                            ],
                        },
                    ],
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
            ],
        }
        self.maxDiff = None
        self.assertEqual(survey.to_json_dict(), expected_dict)

    def test_sms_columns(self):
        survey = utils.create_survey_from_fixture("sms_info", filetype=FIXTURE_FILETYPE)
        expected_dict = {
            "children": [
                {
                    "children": [
                        {
                            "label": "How old are you?",
                            "name": "age",
                            "sms_field": "q1",
                            "type": "integer",
                        },
                        {
                            "children": [
                                {"label": "no", "name": "0", "sms_option": "n"},
                                {"label": "yes", "name": "1", "sms_option": "y"},
                            ],
                            "label": "Do you have any children?",
                            "name": "has_children",
                            "sms_field": "q2",
                            "type": "select one",
                        },
                        {
                            "label": "What's your birth day?",
                            "name": "bday",
                            "sms_field": "q3",
                            "type": "date",
                        },
                        {
                            "label": "What is your name?",
                            "name": "name",
                            "sms_field": "q4",
                            "type": "text",
                        },
                    ],
                    "name": "section1",
                    "sms_field": "a",
                    "type": "group",
                },
                {
                    "children": [
                        {
                            "label": "May I take your picture?",
                            "name": "picture",
                            "type": "photo",
                        },
                        {
                            "label": "Record your GPS coordinates.",
                            "name": "gps",
                            "type": "geopoint",
                        },
                    ],
                    "name": "medias",
                    "sms_field": "c",
                    "type": "group",
                },
                {
                    "children": [
                        {
                            "children": [
                                {
                                    "label": "Mozilla Firefox",
                                    "name": "firefox",
                                    "sms_option": "ff",
                                },
                                {
                                    "label": "Google Chrome",
                                    "name": "chrome",
                                    "sms_option": "gc",
                                },
                                {
                                    "label": "Internet Explorer",
                                    "name": "ie",
                                    "sms_option": "ie",
                                },
                                {
                                    "label": "Safari",
                                    "name": "safari",
                                    "sms_option": "saf",
                                },
                            ],
                            "label": "What web browsers do you use?",
                            "name": "web_browsers",
                            "sms_field": "q5",
                            "type": "select all that apply",
                        }
                    ],
                    "name": "browsers",
                    "sms_field": "b",
                    "type": "group",
                },
                {
                    "children": [
                        {
                            "label": "Phone Number",
                            "name": "phone",
                            "type": "phonenumber",
                        },
                        {"label": "Start DT", "name": "start", "type": "start"},
                        {"label": "End DT", "name": "end", "type": "end"},
                        {"label": "Send Day", "name": "today", "type": "today"},
                        {"label": "IMEI", "name": "imei", "type": "deviceid"},
                        {"label": "Hey!", "name": "nope", "type": "note"},
                    ],
                    "name": "metadata",
                    "sms_field": "meta",
                    "type": "group",
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
            ],
            "default_language": "default",
            "id_string": "sms_info_form",
            "name": "sms_info",
            "sms_allow_media": "TRUE",
            "sms_date_format": "%Y-%m-%d",
            "sms_datetime_format": "%Y-%m-%d-%H:%M",
            "sms_keyword": "inf",
            "sms_separator": "+",
            "title": "SMS Example",
            "type": "survey",
        }
        self.assertEqual(survey.to_json_dict(), expected_dict)

    def test_style_column(self):
        survey = utils.create_survey_from_fixture(
            "style_settings", filetype=FIXTURE_FILETYPE
        )
        expected_dict = {
            "children": [
                {
                    "label": {"english": "What is your name?"},
                    "name": "your_name",
                    "type": "text",
                },
                {
                    "label": {"english": "How many years old are you?"},
                    "name": "your_age",
                    "type": "integer",
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
            ],
            "default_language": "default",
            "id_string": "new_id",
            "name": "style_settings",
            "sms_keyword": "new_id",
            "style": "ltr",
            "title": "My Survey",
            "type": "survey",
        }
        self.assertEqual(survey.to_json_dict(), expected_dict)

    STRIP_NS_FROM_TAG_RE = re.compile(r"\{.+\}")

    def test_style_not_added_to_body_if_not_present(self):
        survey = utils.create_survey_from_fixture("settings", filetype=FIXTURE_FILETYPE)
        xml = survey.to_xml()
        # find the body tag
        root_elm = ETree.fromstring(xml.encode("utf-8"))
        body_elms = list(
            filter(
                lambda e: self.STRIP_NS_FROM_TAG_RE.sub("", e.tag) == "body",
                [c for c in root_elm.getchildren()],
            )
        )
        self.assertEqual(len(body_elms), 1)
        self.assertIsNone(body_elms[0].get("class"))

    def test_style_added_to_body_if_present(self):
        survey = utils.create_survey_from_fixture(
            "style_settings", filetype=FIXTURE_FILETYPE
        )
        xml = survey.to_xml()
        # find the body tag
        root_elm = ETree.fromstring(xml.encode("utf-8"))
        body_elms = list(
            filter(
                lambda e: self.STRIP_NS_FROM_TAG_RE.sub("", e.tag) == "body",
                [c for c in root_elm.getchildren()],
            )
        )
        self.assertEqual(len(body_elms), 1)
        self.assertEqual(body_elms[0].get("class"), "ltr")
