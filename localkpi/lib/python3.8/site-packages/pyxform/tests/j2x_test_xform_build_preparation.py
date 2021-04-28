# -*- coding: utf-8 -*-
"""
Testing preparation of values for XForm exporting
"""
from unittest import TestCase

from pyxform import MultipleChoiceQuestion, Survey


class Json2XformExportingPrepTests(TestCase):
    def test_dictionary_consolidates_duplicate_entries(self):

        yes_or_no_dict_array = [
            {"label": {"French": "Oui", "English": "Yes"}, "name": "yes"},
            {"label": {"French": "Non", "English": "No"}, "name": "no"},
        ]

        first_yesno_question = MultipleChoiceQuestion(
            name="yn_q1", options=yes_or_no_dict_array, type="select one"
        )
        second_yesno_question = MultipleChoiceQuestion(
            name="yn_q2", options=yes_or_no_dict_array, type="select one"
        )

        s = Survey(name="yes_or_no_tests")
        s.add_child(first_yesno_question)
        s.add_child(second_yesno_question)

        # begin the processes in survey.to_xml()
        # 1. validate()
        s.validate()

        # 2. survey._build_options_list_from_descendants()
        # options_list = s._build_options_list_from_descendants()
        # Is this method called somewhere else now?

        # desired_options_list = [first_yesno_question.children]

        # todo: we need to think about whether we care about
        # consolidating these options lists.
        # self.assertEqual(options_list, desired_options_list)
        # self.assertEqual(first_yesno_question._option_list_index_number, 0)
        # self.assertEqual(second_yesno_question._option_list_index_number, 0)
