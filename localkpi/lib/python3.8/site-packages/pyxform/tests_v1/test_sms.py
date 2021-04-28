# -*- coding: utf-8 -*-
"""
Test sms syntax.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class SMSTest(PyxformTestCase):
    def test_prefix_only(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |           |          |       |           |
            |          | type      |   name   | label | hint      |
            |          | string    |   name   | Name  | your name |
            | settings |           |          |       |           |
            |          | prefix    |          |       |           |
            |          | sms_test  |          |       |           |
            """,
            xml__contains=['odk:prefix="sms_test"'],
        )

    def test_delimiter_only(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |           |          |       |           |
            |          | type      |   name   | label | hint      |
            |          | string    |   name   | Name  | your name |
            | settings |           |          |       |           |
            |          | delimiter |          |       |           |
            |          | ~         |          |       |           |
            """,
            xml__contains=['odk:delimiter="~"'],
        )

    def test_prefix_and_delimiter(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |           |          |       |           |
            |          | type      |   name   | label | hint      |
            |          | string    |   name   | Name  | your name |
            | settings |           |          |       |           |
            |          | delimiter | prefix   |       |           |
            |          | *         | sms_test2|       |           |
            """,
            xml__contains=['odk:delimiter="*"', 'odk:prefix="sms_test2"'],
        )

    def test_sms_tag(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey   |           |          |             |       |           |         |
            |          | type      |   name   | compact_tag | label | hint      | default |
            |          | string    |   name   | n           | Name  | your name |         |
            |          | int       |   age    | +a          | Age   | your age  | 7       |
            |          | string    | fruit    |             | Fruit | fav fruit |         |
            """,
            xml__contains=[
                '<name odk:tag="n"/>',
                '<age odk:tag="+a">7</age>',
                "<fruit/>",
            ],
        )
