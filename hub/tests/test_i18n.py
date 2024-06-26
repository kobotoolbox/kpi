# coding: utf-8
import mock
from constance.test import override_config
from django.test import TestCase

from hub.utils.i18n import I18nUtils
from kobo.static_lists import (
    PROJECT_METADATA_DEFAULT_LABELS,
    USER_METADATA_DEFAULT_LABELS,
)
from kpi.utils.json import LazyJSONSerializable


class I18nTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        pass

    def test_welcome_message(self):
        welcome_message_fr = I18nUtils.get_sitewide_message(lang='fr')
        welcome_message_es = I18nUtils.get_sitewide_message(lang='es')
        welcome_message = I18nUtils.get_sitewide_message()

        self.assertEqual(welcome_message_fr, 'Le message de bienvenue')
        self.assertEqual(welcome_message, 'Global welcome message')
        self.assertEqual(welcome_message_es, welcome_message)

    # TODO validate whether the tests below are necessary.
    #   Kinda redundant with kobo/apps/accounts/tests/test_forms.py::AccountFormsTestCase
    @override_config(USER_METADATA_FIELDS=LazyJSONSerializable([
      {
        'name': 'name',
        'required': False,
        'label': {
            'default': 'Full name',
            'fr': 'Prénom et nom',
            'es': 'Nombre y apellido'
        }
      }
    ]))
    def test_user_metadata_fields_with_custom_label(self):
        # Languages exist - return related label
        assert (
            I18nUtils.get_metadata_field_label('name', 'user', 'fr')
            == 'Prénom et nom'
        )
        assert (
            I18nUtils.get_metadata_field_label('name', 'user', 'es')
            == 'Nombre y apellido'
        )
        # No matching languages - return default
        assert (
            I18nUtils.get_metadata_field_label('name', 'user', 'it')
            == 'Full name'
        )
        assert I18nUtils.get_metadata_field_label('name', 'user') == 'Full name'

    @override_config(USER_METADATA_FIELDS=LazyJSONSerializable([
        {
            'name': 'name',
            'required': False
        }
    ]))
    def test_user_metadata_fields_no_label_field(self):
        MOCK_TRANSLATION_STRING = 'hello from gettext_lazy'
        mock_t = mock.MagicMock(return_value=MOCK_TRANSLATION_STRING)

        with mock.patch.dict(
            USER_METADATA_DEFAULT_LABELS,
            {'name': mock_t('My Full name')},
        ) as mock_dict:
            assert (
                I18nUtils.get_metadata_field_label('name', 'user', 'fr')
                == MOCK_TRANSLATION_STRING
            )
            assert (
                I18nUtils.get_metadata_field_label('name', 'user')
                == MOCK_TRANSLATION_STRING
            )
            assert (
                USER_METADATA_DEFAULT_LABELS['name']
                == MOCK_TRANSLATION_STRING
            )
            assert mock_t.call_args.args[0] == 'My Full name'

    @override_config(PROJECT_METADATA_FIELDS=LazyJSONSerializable([
        {
            'name': 'sector',
            'required': False,
            'label': {
                'default': 'Activity sector',
                'fr': 'Secteur d’activités',
                'es': 'Sector de actividad'
            }
        }
    ]))
    def test_project_metadata_fields_with_custom_label(self):
        # Languages exist - return related label
        assert (
            I18nUtils.get_metadata_field_label('sector', 'project', 'fr')
            == 'Secteur d’activités'
        )
        assert (
            I18nUtils.get_metadata_field_label('sector', 'project', 'es')
            == 'Sector de actividad'
        )
        # No matching languages - return default
        assert (
            I18nUtils.get_metadata_field_label('sector', 'project', 'it')
            == 'Activity sector'
        )
        assert (
            I18nUtils.get_metadata_field_label('sector', 'project')
            == 'Activity sector'
        )

    @override_config(PROJECT_METADATA_FIELDS=LazyJSONSerializable([
        {
            'name': 'sector',
            'required': False,
        }
    ]))
    def test_project_metadata_fields_no_label_field(self):
        MOCK_TRANSLATION_STRING = 'hello from gettext_lazy'
        mock_t = mock.MagicMock(return_value=MOCK_TRANSLATION_STRING)

        with mock.patch.dict(
            PROJECT_METADATA_DEFAULT_LABELS,
            {'sector': mock_t('My Sector')},
        ) as mock_dict:
            assert (
                I18nUtils.get_metadata_field_label('sector', 'project', 'fr')
                == MOCK_TRANSLATION_STRING
            )
            assert (
                I18nUtils.get_metadata_field_label('sector', 'project')
                == MOCK_TRANSLATION_STRING
            )
            assert (
                PROJECT_METADATA_DEFAULT_LABELS['sector']
                == MOCK_TRANSLATION_STRING
            )
            assert mock_t.call_args.args[0] == 'My Sector'
