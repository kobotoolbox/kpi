# -*- coding: utf-8 -*-
"""
Test missing headers in XLSForm.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class MissingHeaders(PyxformTestCase):
    """Test missing headers in XLSForm

    When survey and choices columns are missing headers, it is helpful to see
    an error message that prompts the user to include necessary headers.
    """

    def test_missing_survey_headers(self):
        self.assertPyxformXform(
            md="""
            | survey |                 |    |
            |        | select_one list | S1 |
            """,
            errored=True,
            error__contains=["missing important column headers"],
        )

    def test_missing_choice_headers(self):
        self.assertPyxformXform(
            md="""
            | survey  |                 |          |      |
            |         | type            | label    | name |
            |         | select_one list | S1       | s1   |
            | choices |                 |          |      |
            |         | list            | option a | a    |
            |         | list            | option b | b    |
            """,
            errored=True,
            error__contains=["has columns 'list name', 'name', and 'label'"],
        )
