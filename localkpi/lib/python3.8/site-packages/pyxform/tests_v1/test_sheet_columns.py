# -*- coding: utf-8 -*-
"""
Test XLSForm sheet names.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class InvalidSurveyColumnsTests(PyxformTestCase):
    """
    Invalid survey column tests
    """

    def test_missing_name(self):
        """
        every question needs a name (or alias of name)
        """
        self.assertPyxformXform(
            name="invalidcols",
            ss_structure={"survey": [{"type": "text", "label": "label"}]},
            errored=True,
            error__contains=["no name"],
        )

    def test_missing_name_but_has_alias_of_name(self):
        self.assertPyxformXform(
            name="invalidcols",
            ss_structure={
                "survey": [{"value": "q1", "type": "text", "label": "label"}]
            },
            errored=False,
        )

    def test_missing_label(self):
        self.assertPyxformXform(
            name="invalidcols",
            ss_structure={"survey": [{"type": "text", "name": "q1"}]},
            errored=True,
            error__contains=["no label or hint"],
        )

    def test_column_case(self):
        """
        Ensure that column name is case insensitive
        """
        self.assertPyxformXform(
            name="mixedcasecolumns",
            md="""
            | Survey |         |         |               |
            |        | Type    | name    | Label         |
            |        | text    | Name    | the name      |
            |        | integer | age     | the age       |
            |        | text    | gender  | the gender    |
            """,
            errored=False,
            debug=False,
        )


class InvalidChoiceSheetColumnsTests(PyxformTestCase):
    """
    Invalid choice sheet column tests
    """

    def _simple_choice_ss(self, choice_sheet=None):
        """
        Return simple choices sheet
        """

        if choice_sheet is None:
            choice_sheet = []
        return {
            "survey": [
                {
                    "type": "select_one l1",
                    "name": "l1choice",
                    "label": "select one from list l1",
                }
            ],
            "choices": choice_sheet,
        }

    def test_valid_choices_sheet_passes(self):
        """
        Test invalid choices sheet passes
        """

        self.assertPyxformXform(
            name="valid_choices",
            ss_structure=self._simple_choice_ss(
                [
                    {"list_name": "l1", "name": "c1", "label": "choice 1"},
                    {"list_name": "l1", "name": "c2", "label": "choice 2"},
                ]
            ),
            errored=False,
        )

    def test_invalid_choices_sheet_fails(self):
        """
        Test invalid choices sheet fails
        """

        self.assertPyxformXform(
            name="missing_name",
            ss_structure=self._simple_choice_ss(
                [
                    {"list_name": "l1", "label": "choice 1"},
                    {"list_name": "l1", "label": "choice 2"},
                ]
            ),
            errored=True,
            error__contains=["option with no name"],
        )

    def test_missing_list_name(self):
        """
        Test missing sheet name
        """

        self.assertPyxformXform(
            name="missing_list_name",
            ss_structure=self._simple_choice_ss(
                [
                    {"bad_column": "l1", "name": "l1c1", "label": "choice 1"},
                    {"bad_column": "l1", "name": "l1c1", "label": "choice 2"},
                ]
            ),
            debug=False,
            errored=True,
            # some basic keywords that should be in the error:
            error__contains=["choices", "name", "list name"],
        )

    def test_clear_filename_error_message(self):
        """Test clear filename error message"""
        error_message = (
            "The name 'bad@filename' is an invalid XML tag, it "
            "contains an invalid character '@'. Names must begin"
            " with a letter, colon, or underscore, subsequent "
            "characters can include numbers, dashes, and periods"
        )
        self.assertPyxformXform(
            name="bad@filename",
            ss_structure=self._simple_choice_ss(
                [
                    {"list_name": "l1", "name": "c1", "label": "choice 1"},
                    {"list_name": "l1", "name": "c2", "label": "choice 2"},
                ]
            ),
            errored=True,
            error__contains=[error_message],
        )


class AliasesTests(PyxformTestCase):
    """
    Aliases Tests
    """

    def test_value_and_name(self):
        """
        confirm that both 'name' and 'value' columns of choice list work
        """
        for name_alias in ["name", "value"]:
            self.assertPyxformXform(
                name="aliases",
                md="""
                | survey  |               |                |            |
                |         | type          | name           | label      |
                |         | select_one yn | q1             | Question 1 |
                | choices |               |                |            |
                |         | list name     | %(name_alias)s | label      |
                |         | yn            | yes            | Yes        |
                |         | yn            | no             | No         |
                """
                % ({"name_alias": name_alias}),
                instance__contains=["<q1/>"],
                model__contains=['<bind nodeset="/aliases/q1" type="select1"/>'],
                xml__contains=[
                    '<select1 ref="/aliases/q1">',
                    "<value>yes</value>",
                    "<value>no</value>",
                    "</select1>",
                ],
            )


''' # uncomment when re-implemented
    # TODO: test that this fails for the correct reason
    def test_conflicting_aliased_values_raises_error(self):
        # example:
        # an xlsform has {"name": "q_name", "value": "q_value"}
        # should not compile because "name" and "value" columns are aliases

        self.assertPyxformXform(
            # debug=True,
            name="aliases",
            md="""
            | survey |      |        |         |            |
            |        | type | name   | value   | label      |
            |        | text | q_name | q_value | Question 1 |
            """,
            errored=True,
        )
'''
