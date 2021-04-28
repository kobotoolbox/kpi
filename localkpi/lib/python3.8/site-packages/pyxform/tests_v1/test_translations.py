# -*- coding: utf-8 -*-
"""
Test translations syntax.
"""
from __future__ import unicode_literals

from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class DoubleColonTranslations(PyxformTestCase):
    def test_langs(self):
        model_contains = (
            """<bind nodeset="/translations/n1"""
            + """" readonly="true()" type="string"/>"""
        )
        self.assertPyxformXform(
            name="translations",
            id_string="transl",
            md="""
            | survey |      |      |                |               |
            |        | type | name | label::english | label::french |
            |        | note | n1   | hello          | bonjour       |
            """,
            errored=False,
            itext__contains=[
                '<translation lang="french">',
                '<text id="/translations/n1:label">',
                "<value>bonjour</value>",
                "</text>",
                "</translation>",
                '<translation lang="english">',
                '<text id="/translations/n1:label">',
                "<value>hello</value>",
                "</text>",
                "</translation>",
            ],
            xml__contains=["""<label ref="jr:itext('/translations/n1:label')"/>"""],
            model__contains=[model_contains],
        )


class TransaltionsTest(PyxformTestCase):
    """Test XLSForm translations."""

    def test_missing_media_itext(self):
        """Test missing media itext translation

        Fix for https://github.com/XLSForm/pyxform/issues/32
        """
        xform_md = """
        | survey |                                |                    |                                                              |                                               |                 |          |                      |                       |
        |        | name                           | type               | label                                                        | label::Russian                                | label::Kyrgyz   | required | media::audio::Kyrgyz | media::audio::Russian |
        |        | Have_you_received_informed_con | select_one bt7nj36 | A.01 Have you received informed consent from the respondent? | Получили ли вы форму согласия от респондента? | This is Kyrgyz. | true     | something.mp3        | test.mp3              |
        | choices |           |      |       |                |               |
        |         | list name | name | label | label::Russian | label::Kyrgyz |
        |         | bt7nj36   | 0    | No    | Нет            | Нет (ky)      |
        |         | bt7nj36   | 1    | Yes   | Да             | Да (ky)       |
        """
        self.assertPyxformXform(
            name="multi_language_form",
            id_string="multi_language_form",
            md=xform_md,
            errored=False,
            debug=False,
            itext__contains=[
                '<translation default="true()" lang="default">',
                '<text id="/multi_language_form/Have_you_received_informed_con:label">',
                "A.01 Have you received informed consent from the respondent?",
                '<translation lang="Russian">',
                "<value>Получили ли вы форму согласия от респондента?</value>",
                '<value form="audio">jr://audio/test.mp3</value>',
                '<translation lang="Kyrgyz">',
                "<value>This is Kyrgyz.</value>",
                '<value form="audio">jr://audio/something.mp3</value>',
            ],
            itext__excludes=['<value form="audio">jr://audio/-</value>'],
        )
