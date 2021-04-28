# -*- coding: utf-8 -*-
"""
Guidance hint test module.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class GuidanceHintTest(PyxformTestCase):
    """Test guidance_hint XLSForms."""

    def test_hint_only(self):
        """Test hint only column."""
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |           |
            |        | type   |   name   | label | hint      |
            |        | string |   name   | Name  | your name |
            """,
            xml__contains=["<hint>your name</hint>"],
        )

    def test_guidance_hint_and_label(self):
        """Test guidance_hint with label"""
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |                              |
            |        | type   |   name   | label | guidance_hint                |
            |        | string |   name   | Name  | as shown on birth certificate|
            """,  # noqa
            xml__contains=[
                "<hint ref=\"jr:itext('/data/name:hint')\"/>",
                '<value form="guidance">as shown on birth certificate</value>',
                "<hint ref=\"jr:itext('/data/name:hint')\"/>",
            ],
            run_odk_validate=True,
        )

    def test_hint_and_guidance_one_language(self):  # pylint: disable=C0103
        """Test guidance_hint in one language."""
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |           |                              |
            |        | type   |   name   | label | hint      | guidance_hint                |
            |        | string |   name   | Name  | your name | as shown on birth certificate|
            """,  # noqa
            xml__contains=[
                "<hint ref=\"jr:itext('/data/name:hint')\"/>",
                "<value>your name</value>",
                '<value form="guidance">as shown on birth certificate</value>',
            ],
        )

    def test_multi_language_guidance(self):
        """Test guidance_hint in multiple languages."""
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |       |           |                              |                                     |
            |        | type   |   name   | label | hint      | guidance_hint                | guidance_hint::French (fr)          |
            |        | string |   name   | Name  | your name | as shown on birth certificate| comme sur le certificat de naissance|
            """,  # noqa
            xml__contains=[
                '<translation lang="French (fr)">',
                '<value form="guidance">comme sur le certificat de naissance</value>',  # noqa
                '<translation default="true()" lang="default">',
                '<value form="guidance">as shown on birth certificate</value>',
                "<hint ref=\"jr:itext('/data/name:hint')\"/>",
            ],
        )

    def test_guidance_hint_only(self):
        """Test guidance_hint only."""
        self.assertPyxformXform(
            name="data",
            errored=True,
            md="""
            | survey |        |          |                              |
            |        | type   |   name   | guidance_hint                |
            |        | string |   name   | as shown on birth certificate|
            """,
            error__contains=["The survey element named 'name' has no label or hint."],
        )

    def test_multi_language_guidance_only(self):  # pylint:disable=C0103
        """Test guidance_hint only in multiple languages."""
        self.assertPyxformXform(
            name="data",
            errored=True,
            md="""
            | survey |        |          |                              |                                     |
            |        | type   |   name   | guidance_hint                | guidance_hint::French (fr)          |
            |        | string |   name   | as shown on birth certificate| comme sur le certificat de naissance|
            """,  # noqa
            error__contains=["The survey element named 'name' has no label or hint."],
        )

    def test_multi_language_hint(self):
        """Test hint in multiple languages."""
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |        |          |                      |                    |
            |        | type   |   name   | hint                 | hint::French (fr)  |
            |        | string |   name   | default language hint| French hint        |
            """,  # noqa
            xml__contains=[
                "<hint ref=\"jr:itext('/data/name:hint')\"/>",
                "<value>French hint</value>",
                "<value>default language hint</value>",
            ],
        )
