# coding: utf-8
from django.test import TestCase


from kpi.utils.asset_translation_utils import (
                    compare_translations,
                    TRANSLATIONS_EQUAL,
                    TRANSLATIONS_OUT_OF_ORDER,
                    TRANSLATIONS_MULTIPLE_CHANGES,
                    TRANSLATION_RENAMED,
    )


class AssetTranslationTests(TestCase):
    def test_equality(self):
        self.assertTrue(TRANSLATIONS_EQUAL in
                        compare_translations(
                            ['a', 'b', 'c'],
                            ['a', 'b', 'c'],
                        ),
                        )
        self.assertTrue(TRANSLATIONS_EQUAL in
                        compare_translations(
                            [None, 'a', 'b', 'c'],
                            [None, 'a', 'b', 'c'],
                        ),
                        )

    def test_out_of_order(self):
        self.assertTrue(TRANSLATIONS_OUT_OF_ORDER in
                        compare_translations(
                            [None, 'a', 'b', 'c'],
                            ['a', 'b', 'c', None],
                        ),
                        )
        self.assertTrue(TRANSLATIONS_OUT_OF_ORDER in
                        compare_translations(
                            [None, 'a', 'b', 'c'],
                            ['a', None, 'b', 'c'],
                        ),
                        )

    def test_translation_renamed(self):
        _renamed_params = compare_translations(
            [None, 'a', 'b', 'c'],
            [None, 'a', 'b', 'Z'],
        )

        self.assertTrue(TRANSLATION_RENAMED in _renamed_params)
        first_change = _renamed_params[TRANSLATION_RENAMED]['changes'][0]
        self.assertEqual(first_change['index'], 3)
        self.assertEqual(first_change['from'], 'c')
        self.assertEqual(first_change['to'], 'Z')

    def test_translations_too_changed(self):
        _params = compare_translations(
            [None, 'a', 'b', 'c'],
            [None, 'a', 'y', 'z'],
        )
        self.assertTrue(TRANSLATIONS_MULTIPLE_CHANGES in _params)
