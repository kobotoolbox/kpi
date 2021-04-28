# -*- coding: utf-8 -*-
"""
Test XForm structure.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class XmlStructureTest(PyxformTestCase):
    def test_xml_structure(self):
        # re: https://github.com/XLSForm/pyxform/issues/14
        self.assertPyxformXform(
            name="testxmlstructure",
            md="""
            | survey |      |      |       |
            |        | type | name | label |
            |        | note | q    | Q     |
            """,
            xml__contains=[
                'xmlns="http://www.w3.org/2002/xforms"',
                'xmlns:h="http://www.w3.org/1999/xhtml"',
                'xmlns:jr="http://openrosa.org/javarosa"',
                'xmlns:orx="http://openrosa.org/xforms"',
                'xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
            ],
        )
