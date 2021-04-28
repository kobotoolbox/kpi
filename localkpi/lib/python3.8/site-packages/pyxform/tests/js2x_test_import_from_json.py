# -*- coding: utf-8 -*-
"""
Testing our ability to import from a JSON text file.
"""
from unittest import TestCase

from pyxform.builder import create_survey_element_from_dict


class Json2XformTestJsonImport(TestCase):
    def test_simple_questions_can_be_imported_from_json(self):
        json_text = {
            "type": "survey",
            "name": "Exchange rate",
            "children": [
                {
                    "label": {"French": "Combien?", "English": "How many?"},
                    "type": "decimal",
                    "name": "exchange_rate",
                }
            ],
        }
        s = create_survey_element_from_dict(json_text)

        self.assertEqual(s.children[0].type, "decimal")
