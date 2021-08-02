# coding: utf-8
from django.test import TestCase

from hub.utils.i18n import I18nUtils


class I18nTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        pass

    def test_welcome_message(self):
        welcome_message_fr = I18nUtils.get_sitewide_message(lang="fr")
        welcome_message_es = I18nUtils.get_sitewide_message(lang="es")
        welcome_message = I18nUtils.get_sitewide_message()

        self.assertEqual(welcome_message_fr.raw, "Le message de bienvenue")
        self.assertEqual(welcome_message.raw, "Global welcome message")
        self.assertEqual(welcome_message_es.raw, welcome_message.raw)
