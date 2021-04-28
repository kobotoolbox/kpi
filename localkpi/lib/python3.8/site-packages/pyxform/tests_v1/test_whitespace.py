# -*- coding: utf-8 -*-
"""
Test whitespace around output variables in XForms.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class WhitespaceTest(PyxformTestCase):
    def test_over_trim(self):
        self.assertPyxformXform(
            name="issue96",
            md="""
            | survey  |                 |             |       |
            |         | type            | label       | name  |
            |         | text            | Ignored     | var   |
            |         | note            | ${var} text | label |
            """,
            xml__contains=['<label><output value=" /issue96/var "/> text </label>'],
        )

    def test_values_without_whitespaces_are_processed_successfully(self):
        md = """
            | survey  |                 |             |       |
            |         | type            | label       | name  |
            |         | text            | Ignored     | Var   |
            | settings       |                    |            |                                                   |
            |                | id_string          | public_key | submission_url                                    |
            |                | tutorial_encrypted | MIIB       | https://odk.ona.io/random_person/submission       |
          """

        survey = self.md_to_pyxform_survey(md_raw=md)
        expected = """<submission action="https://odk.ona.io/random_person/submission" base64RsaPublicKey="MIIB" method="post"/>"""
        xml = survey._to_pretty_xml()
        self.assertEqual(1, xml.count(expected))
        self.assertPyxformXform(md=md, xml__contains=expected, run_odk_validate=True)
