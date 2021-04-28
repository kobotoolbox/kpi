# -*- coding: utf-8 -*-
"""
Test unicode characters in validate error messages.
"""

from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class ValidateUnicodeException(PyxformTestCase):
    """
    Validation errors may include non-ASCII characters. In particular, ODK Validate
    uses ͎ (small arrow) to indicate where a problem starts.
    """

    def test_validate_unicode_exception(self):
        self.assertPyxformXform(
            md="""
            | survey  |           |       |       |                |
            |         | type      | name  | label | calculation    |
            |         | calculate | bad   | bad   | $(myField)='1' |
            """,
            run_odk_validate=True,
            odk_validate_error__contains=[
                'Invalid calculate for the bind attached to "${bad}" : Couldn\'t '
                "understand the expression starting at this point:"
            ],
        )
