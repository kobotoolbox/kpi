# -*- coding: utf-8 -*-
"""
Testing simple cases for Xls2Json
"""
from unittest import TestCase

from pyxform.builder import create_survey_element_from_dict
from pyxform.tests import utils
from pyxform.xls2json import SurveyReader


class GroupTests(TestCase):
    def test_json(self):
        x = SurveyReader(utils.path_to_text_fixture("group.xls"))
        x_results = x.to_json_dict()
        expected_dict = {
            "name": "group",
            "title": "group",
            "id_string": "group",
            "sms_keyword": "group",
            "default_language": "default",
            "type": "survey",
            "children": [
                {
                    "name": "family_name",
                    "type": "text",
                    "label": {"English": "What's your family name?"},
                },
                {
                    "name": "father",
                    "type": "group",
                    "label": {"English": "Father"},
                    "children": [
                        {
                            "name": "phone_number",
                            "type": "phone number",
                            "label": {"English": "What's your father's phone number?"},
                        },
                        {
                            "name": "age",
                            "type": "integer",
                            "label": {"English": "How old is your father?"},
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
        self.assertEqual(x_results, expected_dict)

    def test_equality_of_to_dict(self):
        x = SurveyReader(utils.path_to_text_fixture("group.xls"))
        x_results = x.to_json_dict()

        survey = create_survey_element_from_dict(x_results)
        survey_dict = survey.to_json_dict()
        # using the builder sets the title attribute to equal name
        # this won't happen through reading the excel file as done by
        # SurveyReader.
        # Now it happens.
        # del survey_dict[u'title']
        self.maxDiff = None
        self.assertEqual(x_results, survey_dict)
