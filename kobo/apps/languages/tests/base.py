# coding: utf-8
from django.test import TestCase

from ..models.transcription import TranscriptionService
from ..models.translation import TranslationService


class BaseTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.asr_service = TranscriptionService.objects.get(code='goog')
        self.mt_service = TranslationService.objects.get(code='msft')
