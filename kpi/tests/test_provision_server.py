import json
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from allauth.socialaccount.models import SocialApp
from kobo.apps.accounts.models import SocialAppCustomData


class ProvisionServerCommandTest(TestCase):

    @patch('os.getenv')
    def test_handle_successful_creation(self, mock_getenv):
        mock_getenv.return_value = None

        self.assertEqual(SocialApp.objects.count(), 0)
        self.assertEqual(SocialAppCustomData.objects.count(), 0)

        call_command(
            'provision_server',
            'socialapp',
            'openid_connect',
            'test_provider_id',
            'Test Organization',
            'test_client_id',
            'test_secret',
            '',
            '{"key": "value"}',
        )

        self.assertEqual(SocialApp.objects.count(), 1)
        self.assertEqual(SocialAppCustomData.objects.count(), 1)

        social_app = SocialApp.objects.first()
        self.assertEqual(social_app.provider, 'openid_connect')
        self.assertEqual(social_app.provider_id, 'test_provider_id')
        self.assertEqual(social_app.name, 'Test Organization')
        self.assertEqual(social_app.client_id, 'test_client_id')
        self.assertEqual(social_app.secret, 'test_secret')
        self.assertEqual(social_app.settings, {'key': 'value'})

    @patch('os.getenv')
    def test_handle_existing_social_app(self, mock_getenv):
        mock_getenv.return_value = None

        SocialApp.objects.create(
            provider='openid_connect',
            provider_id='test_provider_id',
            name='Test Organization',
            client_id='test_client_id',
            secret='test_secret',
            key='',
            settings={'key': 'value'},
        )

        self.assertEqual(SocialApp.objects.count(), 1)

        call_command(
            'provision_server',
            'socialapp',
            'openid_connect',
            'test_provider_id',
            'Test Organization',
            'test_client_id',
            'test_secret',
            '',
            '{"key": "value"}',
        )

        self.assertEqual(SocialApp.objects.count(), 1)
        self.assertEqual(SocialAppCustomData.objects.count(), 1)

    @patch('os.getenv')
    def test_handle_invalid_json(self, mock_getenv):
        mock_getenv.return_value = None

        with self.assertRaises(json.JSONDecodeError):
            call_command(
                'provision_server',
                'socialapp',
                'openid_connect',
                'test_provider_id',
                'Test Organization',
                'test_client_id',
                'test_secret',
                '',
                '{"invalid_json"}',
            )

    @patch('os.getenv')
    def test_handle_with_env_secret(self, mock_getenv):
        mock_getenv.return_value = 'env_secret'

        self.assertEqual(SocialApp.objects.count(), 0)

        call_command(
            'provision_server',
            'socialapp',
            'openid_connect',
            'test_provider_id',
            'Test Organization',
            'test_client_id',
            'test_secret',
            '',
            '{"key": "value"}',
        )

        self.assertEqual(SocialApp.objects.count(), 1)
        social_app = SocialApp.objects.first()
        self.assertEqual(social_app.secret, 'env_secret')

    @patch('kpi.management.commands.provision_server.config')
    def test_update_existing_config_key(self, mock_config):
        setattr(mock_config, 'TEST_CONFIG_KEY', 'old_value')
        call_command(
            'provision_server',
            'config',
            'TEST_CONFIG_KEY',
            'new_value',
        )
        self.assertEqual(getattr(mock_config, 'TEST_CONFIG_KEY'), 'new_value')

    @patch('kpi.management.commands.provision_server.config')
    def test_update_non_existing_config_key(self, mock_config):
        delattr(mock_config, 'NON_EXISTENT_KEY')
        call_command(
            'provision_server',
            'config',
            'NON_EXISTENT_KEY',
            'new_value',
        )

        self.assertFalse(hasattr(mock_config, 'NON_EXISTENT_KEY'))
