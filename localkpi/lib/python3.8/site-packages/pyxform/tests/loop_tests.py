# -*- coding: utf-8 -*-
"""
Test loop syntax.
"""
from unittest import TestCase

from pyxform.builder import create_survey_from_xls
from pyxform.tests import utils


class LoopTests(TestCase):
    def test_loop(self):
        path = utils.path_to_text_fixture("another_loop.xls")
        survey = create_survey_from_xls(path)
        self.maxDiff = None
        expected_dict = {
            "name": "another_loop",
            "id_string": "another_loop",
            "sms_keyword": "another_loop",
            "default_language": "default",
            "title": "another_loop",
            "type": "survey",
            "children": [
                {
                    "name": "loop_vehicle_types",
                    "type": "group",
                    "children": [
                        {
                            "label": {"English": "Car", "French": "Voiture"},
                            "name": "car",
                            "type": "group",
                            "children": [
                                {
                                    "label": {
                                        "English": "How many do you have?",
                                        "French": "Combien avoir?",
                                    },
                                    "name": "total",
                                    "type": "integer",
                                },
                                {
                                    "bind": {"constraint": ". <= ../total"},
                                    "label": {
                                        "English": "How many are working?",
                                        "French": "Combien marcher?",
                                    },
                                    "name": "working",
                                    "type": "integer",
                                },
                            ],
                        },
                        {
                            "label": {"English": "Motorcycle", "French": "Moto"},
                            "name": "motor_cycle",
                            "type": "group",
                            "children": [
                                {
                                    "label": {
                                        "English": "How many do you have?",
                                        "French": "Combien avoir?",
                                    },
                                    "name": "total",
                                    "type": "integer",
                                },
                                {
                                    "bind": {"constraint": ". <= ../total"},
                                    "label": {
                                        "English": "How many are working?",
                                        "French": "Combien marcher?",
                                    },
                                    "name": "working",
                                    "type": "integer",
                                },
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
        self.assertEquals(survey.to_json_dict(), expected_dict)
