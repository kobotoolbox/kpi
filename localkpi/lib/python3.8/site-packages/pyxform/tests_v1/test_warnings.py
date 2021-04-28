# -*- coding: utf-8 -*-
"""
Test warnings.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class TestWarnings(PyxformTestCase):
    def test_l1(self):
        self.assertPyxformXform(
            name="test_l1",
            md="""
                | survey |      |           |        |
                |        | type | name      | hint   |
                |        | text | some_text | a hint |
                """,
            instance__contains=["<some_text/>"],
            model__contains=['<bind nodeset="/test_l1/some_text" type="string"/>'],
            xml__contains=[
                '<input ref="/test_l1/some_text">',
                "<hint>a hint</hint>",  # nopep8
                "</input>",
            ],
        )

    def test_l2(self):
        self.assertPyxformXform(
            name="img_test",
            md="""
                | survey |      |                  |              |
                |        | type | name             | image        |
                |        | note | display_img_test | img_test.jpg |
                """,
            model__contains=[
                '<bind nodeset="/img_test/display_img_test" readonly="true()" '
                'type="string"/>'
            ],
            instance__contains=["<display_img_test/>"],
            xml__contains=[
                '<translation default="true()" lang="default">',
                # and further down...
                """<label ref="jr:itext('/img_test/display_img_test:label')"/>""",
            ],
        )
