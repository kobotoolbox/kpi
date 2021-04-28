# -*- coding: utf-8 -*-
"""
Test language warnings.
"""
import os
import tempfile

from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class LanguageWarningTest(PyxformTestCase):
    """
    Test language warnings.
    """

    def test_label_with_valid_subtag_should_not_warn(self):
        survey = self.md_to_pyxform_survey(
            """
            | survey |      |         |                     |
            |        | type | name    | label::English (en) |
            |        | note | my_note | My note             |
            """
        )

        warnings = []
        tmp = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)
        tmp.close()
        survey.print_xform_to_file(tmp.name, warnings=warnings)

        self.assertTrue(len(warnings) == 0)
        os.unlink(tmp.name)

    def test_label_with_no_subtag_should_warn(self):
        survey = self.md_to_pyxform_survey(
            """
            | survey |      |         |                     |
            |        | type | name    | label::English      |
            |        | note | my_note | My note             |
            """
        )

        warnings = []
        tmp = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)
        tmp.close()
        survey.print_xform_to_file(tmp.name, warnings=warnings)

        self.assertTrue(len(warnings) == 1)
        self.assertTrue(
            "do not contain valid machine-readable codes: English. Learn more"
            in warnings[0]
        )
        os.unlink(tmp.name)

    def test_label_with_unknown_subtag_should_warn(self):
        survey = self.md_to_pyxform_survey(
            """
            | survey |      |         |                       |
            |        | type | name    | label::English (schm) |
            |        | note | my_note | My note               |
            """
        )

        warnings = []
        tmp = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)
        tmp.close()
        survey.print_xform_to_file(tmp.name, warnings=warnings)

        self.assertTrue(len(warnings) == 1)
        self.assertTrue(
            "do not contain valid machine-readable codes: English (schm). Learn more"
            in warnings[0]
        )
        os.unlink(tmp.name)

    def test_default_language_only_should_not_warn(self):
        survey = self.md_to_pyxform_survey(
            """
            | survey |                 |         |        |               |
            |        | type            | name    | label  | choice_filter |
            |        | select_one opts | opt     | My opt | fake = 1      |
            | choices|                 |         |        |               |
            |        | list_name       | name    | label  | fake          |
            |        | opts            | opt1    | Opt1   | 1             |
            |        | opts            | opt2    | Opt2   | 1             |
            """
        )

        warnings = []
        tmp = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)
        tmp.close()
        survey.print_xform_to_file(tmp.name, warnings=warnings)

        self.assertTrue(len(warnings) == 0)
        os.unlink(tmp.name)
