# -*- coding: utf-8 -*-
"""
Test custom namespaces.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase

MD = """
| survey   |                                                                                              |      |       |
|          | type                                                                                         | name | label |
|          | note                                                                                         | q    | Q     |
| settings |                                                                                              |      |       |
|          | namespaces                                                                                   |      |       |
|          | esri="http://esri.com/xforms" enk="http://enketo.org/xforms" naf="http://nafundi.com/xforms" |      |       |
"""  # nopep8


class CustomXMLNamespacesTest(PyxformTestCase):
    """
    Test custom namespaces.
    """

    def test_custom_xml_name_spaces(self):
        # re: https://github.com/XLSForm/pyxform/issues/65
        self.assertPyxformXform(
            name="custom_namespaces",
            md=MD,
            xml__contains=[
                'xmlns="http://www.w3.org/2002/xforms"',
                'xmlns:h="http://www.w3.org/1999/xhtml"',
                'xmlns:jr="http://openrosa.org/javarosa"',
                'xmlns:orx="http://openrosa.org/xforms"',
                'xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
                'xmlns:esri="http://esri.com/xforms"',
                'xmlns:enk="http://enketo.org/xforms"',
                'xmlns:naf="http://nafundi.com/xforms"',
            ],
        )
