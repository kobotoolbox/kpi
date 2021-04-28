# -*- coding: utf-8 -*-
"""
Test round(number, precision) calculation.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class RoundCalculationTest(PyxformTestCase):
    def test_non_existent_itext_reference(self):
        self.assertPyxformXform(
            name="ecsv",
            md="""
            | survey |             |                |         |                     |
            |        | type        | name           | label   | calculation         |
            |        | decimal     | amount         | Counter |                     |
            |        | calculate   | rounded        | Rounded | round(${amount}, 0) |
            """,  # noqa
            xml__contains=["""<instance>"""],
            run_odk_validate=True,
        )
