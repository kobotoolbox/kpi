# coding: utf-8
import pytest

from .base import BaseTestCase
from ..exceptions import LanguageNotSupported


class TranscriptionServiceTestCase(BaseTestCase):

    def test_get_language_from_language_code(self):
        self.assertEqual(self.asr_service.get_language_code('en'), 'en')

    def test_get_language_from_region_code(self):
        self.assertEqual(self.asr_service.get_language_code('en-US'), 'en-US')

    def test_get_language_with_mapping_code(self):
        # In some cases, the service uses a different region code
        self.assertEqual(self.asr_service.get_language_code('he-IL'), 'iw-IL')

    def test_get_not_supported_language(self):
        with pytest.raises(LanguageNotSupported):
            self.assertNotEqual(self.asr_service.get_language_code('af'), 'af')


class TranslationServiceTestCase(BaseTestCase):

    def test_get_language_from_language_code(self):
        self.assertEqual(self.mt_service.get_language_code('fr'), 'fr')

    def test_get_language_from_region_code(self):
        # Usually, only the language code is needed for translation, but some
        # services also support regions (e.g. Microsoft with French Canadian)
        self.assertEqual(self.mt_service.get_language_code('fr-CA'), 'fr-CA')

    def test_get_language_with_mapping_code(self):
        # In some cases, the service uses a different code
        self.assertEqual(self.mt_service.get_language_code('sr-RS'), 'sr-Latn')

    def test_get_not_supported_language(self):
        with pytest.raises(LanguageNotSupported):
            self.assertNotEqual(self.mt_service.get_language_code('af'), 'af')
