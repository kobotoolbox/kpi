# -*- coding: utf-8 -*-
"""
Test duplicate survey question field name.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class FieldsTests(PyxformTestCase):
    """
    Test XLSForm Fields
    """

    def test_duplicate_fields(self):
        """
        Ensure that duplicate field names are not allowed
        """
        self.assertPyxformXform(
            name="duplicatefields",
            md="""
            | Survey |         |         |               |
            |        | Type    | Name    | Label         |
            |        | integer | age     | the age       |
            |        | integer | age     | the age       |
            """,
            errored=True,
            error__contains=["There are more than one survey elements named 'age'"],
        )

    def test_duplicate_fields_diff_cases(self):
        """
        Ensure that duplicate field names with different cases are not allowed
        """
        self.assertPyxformXform(
            name="duplicatefieldsdiffcases",
            md="""
            | Survey |         |         |               |
            |        | Type    | Name    | Label         |
            |        | integer | age     | the age       |
            |        | integer | Age     | the age       |
            """,
            errored=True,
            error__contains=["There are more than one survey elements named 'age'"],
        )

    def test_duplicate_choice_list_without_settings(self):
        self.assertPyxformXform(
            md="""
            | survey  |                 |          |       |
            |         | type            | name     | label |
            |         | select_one list | S1       | s1    |
            | choices |                 |          |       |
            |         | list name       | name     | label  |
            |         | list            | option a | a      |
            |         | list            | option b | b      |
            |         | list            | option b | c      |
            """,
            errored=True,
            error__contains=[
                "There does not seem to be a"
                " `allow_choice_duplicates` column header defined"
                " in your settings sheet"
            ],  # noqa
        )

    def test_duplicate_choice_list_with_wrong_setting(self):
        self.assertPyxformXform(
            md="""
            | survey  |                 |          |       |
            |         | type            | name     | label |
            |         | select_one list | S1       | s1    |
            | choices |                 |          |       |
            |         | list name       | name     | label  |
            |         | list            | option a | a      |
            |         | list            | option b | b      |
            |         | list            | option b | c      |
            | settings |                |          |        |
            |          | id_string    | allow_choice_duplicates   |
            |          | Duplicates   | True                       |
            """,
            errored=True,
            error__contains=[
                "On the choices sheet the choice list name"
                " 'option b' occurs more than once."
            ],  # noqa
        )

    def test_duplicate_choice_list_with_setting(self):
        md = """
            | survey  |                 |          |       |
            |         | type            | name     | label |
            |         | select_one list | S1       | s1    |
            | choices |                 |          |       |
            |         | list name       | name     | label  |
            |         | list            | option a | a      |
            |         | list            | option b | b      |
            |         | list            | option b | c      |
            | settings |                |          |        |
            |          | id_string    | allow_choice_duplicates   |
            |          | Duplicates   | Yes                       |
            """

        expected = """
    <select1 ref="/pyxform_autotestname/S1">
      <label>s1</label>
      <item>
        <label>a</label>
        <value>option a</value>
      </item>
      <item>
        <label>b</label>
        <value>option b</value>
      </item>
      <item>
        <label>c</label>
        <value>option b</value>
      </item>
    </select1>
"""
        self.assertPyxformXform(md=md, xml__contains=[expected], run_odk_validate=True)

    def test_choice_list_without_duplicates_is_successful(self):
        md = """
            | survey  |                 |          |       |
            |         | type            | name     | label |
            |         | select_one list | S1       | s1    |
            | choices |                 |          |       |
            |         | list name       | name     | label  |
            |         | list            | option a | a      |
            |         | list            | option b | b      |
            | settings |                |          |        |
            |          | id_string    | allow_choice_duplicates   |
            |          | Duplicates   | Yes                       |
            """

        expected = """
    <select1 ref="/pyxform_autotestname/S1">
      <label>s1</label>
      <item>
        <label>a</label>
        <value>option a</value>
      </item>
      <item>
        <label>b</label>
        <value>option b</value>
      </item>
    </select1>
"""
        self.assertPyxformXform(md=md, xml__contains=[expected], run_odk_validate=True)
