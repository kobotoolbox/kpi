# -*- coding: utf-8 -*-
"""
Ensuring that the pyxform_test_case.PyxformTestCase class does some
internal conversions correctly.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class PyxformTestCaseNonMarkdownSurveyAlternatives(PyxformTestCase):
    def test_tainted_vanilla_survey_failure(self):
        """
        the _invalid_ss_structure structure should fail to compile
        because the note has no label.

        if "errored" parameter is not set to False, it should
        raise an exception
        """
        _invalid_ss_structure = {"survey": [{"type": "note", "name": "n1"}]}

        def _no_valid_flag():
            """
            when the 'errored' flag is set to false (default) and the survey
            fails to compile, the test should raise an exception.
            """
            self.assertPyxformXform(
                ss_structure=_invalid_ss_structure,
                errored=False,  # errored=False by default
            )

        self.assertRaises(Exception, _no_valid_flag)

        # however when errored=True is present,
        self.assertPyxformXform(
            ss_structure=_invalid_ss_structure,
            errored=True,
            error__contains=["The survey element named 'n1' has no label or hint."],
        )

    def test_vanilla_survey(self):
        """
        testing that a survey can be passed as a _spreadsheet structure_ named
        'ss_structure'.

        this will be helpful when testing whitespace constraints and
        cell data types since markdown'd surveys strip spaces and
        cast empty strings to None values
        """
        self.assertPyxformXform(
            ss_structure={
                "survey": [{"type": "note", "name": "n1", "label": "Note 1"}]
            },
            errored=False,
        )


class XlsFormPyxformSurveyTest(PyxformTestCase):
    def test_formid_is_not_none(self):
        """
        When the form id is not set, it should never use python's
        None. Fixing because this messes up other tests.
        """
        s1 = self.md_to_pyxform_survey(
            """
            | survey |      |      |       |
            |        | type | name | label |
            |        | note | q    | Q     |
            """,
            {},
            autoname=True,
        )

        if s1.id_string in ["None", None]:
            self.assertRaises(Exception, lambda: s1.validate())
