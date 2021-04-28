# -*- coding: utf-8 -*-
"""
AreaTest - test enclosed-area(geo_shape) calculation.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase

MD = """
| survey |           |           |                         |                             |                                                                                                                                                                                           |
|        | type      | name      | label                   | calculation                 | default                                                                                                                                                                                   |
|        | geoshape  | geoshape1 | Draw your shape here... |                             | 38.253094215699576 21.756382658677467;38.25021274773806 21.756382658677467;38.25007793942195 21.763892843919166;38.25290886154963 21.763935759263404;38.25146813817506 21.758421137528785 |
|        | calculate | result    |                         | enclosed-area(${geoshape1}) |                                                                                                                                                                                           |
"""  # nopep8

XML_CONTAINS = """
<bind calculate="enclosed-area( /area/geoshape1 )" nodeset="/area/result" type="string"/>
""".strip()  # nopep8


class AreaTest(PyxformTestCase):
    """
    AreaTest - test enclosed-area(geo_shape) calculation.
    """

    def test_area(self):
        self.assertPyxformXform(
            name="area", md=MD, xml__contains=[XML_CONTAINS], debug=False
        )
