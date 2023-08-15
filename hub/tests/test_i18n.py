# coding: utf-8
from django.test import TestCase

from hub.utils.i18n import I18nUtils
from kobo.static_lists import (
    PROJECT_METADATA_DEFAULT_LABELS,
    USER_METADATA_DEFAULT_LABELS,
)


class I18nTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        pass

    def test_welcome_message(self):
        welcome_message_fr = I18nUtils.get_sitewide_message(lang="fr")
        welcome_message_es = I18nUtils.get_sitewide_message(lang="es")
        welcome_message = I18nUtils.get_sitewide_message()

        self.assertEqual(welcome_message_fr, "Le message de bienvenue")
        self.assertEqual(welcome_message, "Global welcome message")
        self.assertEqual(welcome_message_es, welcome_message)

    def test_custom_label_translations(self):
        def check_labels(field, default_labels, lang):
            new_field = I18nUtils.set_custom_label(field, default_labels, lang)
            assert new_field['name'] == field['name']
            assert new_field['required'] == field['required']
            assert new_field['label'] == field['label'][lang]

        user_metadata_field = {
            'name': 'Full name',
            'required': False,
            'label': {'default': 'Name', 'fr': 'Nom'},
        }

        project_metadata_field = {
            'name': 'description',
            'required': True,
            'label': {'default': 'Description', 'fr': 'Details'},
        }

        check_labels(user_metadata_field, USER_METADATA_DEFAULT_LABELS, 'fr')
        check_labels(
            project_metadata_field, PROJECT_METADATA_DEFAULT_LABELS, 'fr'
        )

    def test_metadata_no_label_field(self):
        def check_labels(field, default_labels, lang):
            new_field = I18nUtils.set_custom_label(field, default_labels, lang)
            assert new_field['name'] == field['name']
            assert new_field['required'] == field['required']
            assert new_field['label'] == default_labels[field['name']]

        user_metadata_field = {
            'name': 'full_name',
            'required': False,
        }

        project_metadata_field = {
            'name': 'description',
            'required': True,
        }

        check_labels(user_metadata_field, USER_METADATA_DEFAULT_LABELS, 'fr')
        check_labels(
            project_metadata_field, PROJECT_METADATA_DEFAULT_LABELS, 'fr'
        )

    def test_custom_label_no_lang(self):
        def check_labels(field, default_labels, lang):
            new_field = I18nUtils.set_custom_label(field, default_labels, lang)
            assert new_field['name'] == field['name']
            assert new_field['required'] == field['required']
            assert new_field['label'] == field['label']['default']

        user_metadata_field = {
            'name': 'full_name',
            'required': False,
            'label': {'default': 'Name'},
        }

        project_metadata_field = {
            'name': 'description',
            'required': True,
            'label': {'default': 'Description'},
        }
        check_labels(
            user_metadata_field,
            USER_METADATA_DEFAULT_LABELS,
            None
        )
        check_labels(
            project_metadata_field,
            PROJECT_METADATA_DEFAULT_LABELS,
            None
        )
