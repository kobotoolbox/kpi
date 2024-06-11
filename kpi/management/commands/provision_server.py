import json
import os

from constance import config
from django.core.management.base import BaseCommand

from allauth.socialaccount.models import SocialApp
from kobo.apps.accounts.models import SocialAppCustomData


class Command(BaseCommand):
    help = (
        'Provision server settings including social apps and constance configs'
    )

    def add_arguments(self, parser):
        subparsers = parser.add_subparsers(dest='command')

        # Subcommand for managing social apps
        socialapp_parser = subparsers.add_parser(
            'socialapp', help='Insert a social app and related custom data'
        )

        socialapp_parser.add_argument(
            'provider', type=str, help='Either openid_connect or microsoft'
        )
        socialapp_parser.add_argument(
            'provider_id', type=str, help='Provider ID used in the login url'
        )
        socialapp_parser.add_argument(
            'name',
            type=str,
            help='Name of the organization displayed on the login page',
        )
        socialapp_parser.add_argument(
            'client_id', type=str, help='App ID, or consumer key'
        )
        socialapp_parser.add_argument(
            'secret',
            nargs='?',
            type=str,
            default='',
            help='API secret, client secret, or consumer secret',
        )
        socialapp_parser.add_argument(
            'key',
            nargs='?',
            type=str,
            default='',
            help='Key provided by client',
        )
        socialapp_parser.add_argument(
            'settings',
            type=str,
            help='Settings in json format enclosed with single quotes',
        )

        # Subcommand for managing configurations
        config_parser = subparsers.add_parser(
            'config', help='Update application configuration'
        )
        config_parser.add_argument(
            'config_kv_pairs', nargs='+', type=str, help='Constance configuration values as key=value pairs'
        )

    def handle(self, *args, **kwargs):
        command = kwargs.get('command')

        if command == 'socialapp':
            self.handle_socialapp(kwargs)
        elif command == 'config':
            self.handle_config(kwargs)
        else:
            self.stdout.write(self.style.ERROR('No valid subcommand provided'))

    def handle_socialapp(self, kwargs):
        provider = kwargs['provider']
        provider_id = kwargs['provider_id']
        name = kwargs['name']
        client_id = kwargs['client_id']
        secret = os.getenv('SOCIAL_APP_SECRET') or kwargs['secret']
        key = kwargs['key']
        settings_json = kwargs['settings']

        try:
            settings = json.loads(settings_json)
        except TypeError:
            raise json.JSONDecodeError

        social_app_data = {
            'provider': provider,
            'provider_id': provider_id,
            'name': name,
            'client_id': client_id,
            'secret': secret,
            'key': key,
            'settings': settings,
        }

        social_app, created = SocialApp.objects.get_or_create(
            defaults=social_app_data
        )

        if not created:
            self.stdout.write(
                f'Social app for {social_app.name} already exists'
            )
        else:
            self.stdout.write(
                f'Successfully created social app for {social_app.name}'
            )

        social_app_custom_data_exists = SocialAppCustomData.objects.filter(
            social_app=social_app
        ).exists()

        if not social_app_custom_data_exists:
            SocialAppCustomData.objects.create(
                social_app=social_app,
                is_public=False,
            )
            self.stdout.write(
                f'Successfully created custom data for {social_app.name}'
            )
        else:
            self.stdout.write(
                f'Custom data for {social_app.name} already exists'
            )

    def handle_config(self, kwargs):
        config_kv_pairs = kwargs['config_kv_pairs']
        for pair in config_kv_pairs:
                key, value = pair.split('=')
                if hasattr(config, key):
                    try:
                        if value.lower() == 'true':
                            value = True
                        elif value.lower() == 'false':
                            value = False
                        else:
                            # Specific handling for fields taking JSON arrays
                            if key in ['PROJECT_METADATA_FIELDS', 'USER_METADATA_FIELDS']:
                                if value.startswith('[') and value.endswith(']'):
                                    try:
                                        value = json.loads(value)
                                        value = json.dumps(value)
                                    except json.JSONDecodeError as e:
                                        self.stdout.write(f'Invalid JSON array value for key {key}. {e}')
                                        continue
                                else:
                                    self.stdout.write(f'Invalid JSON array format for key {key}. Should start and end with "[" and "]".')
                                    continue
                            # Handling for other keys that should be JSON objects
                            else:
                                if value.startswith('{') and value.endswith('}'):
                                    try:
                                        value = json.loads(value)
                                        value = json.dumps(value)
                                    except json.JSONDecodeError as e:
                                        self.stdout.write(f'Invalid JSON object value for key {key}. {e}')
                                        continue

                        setattr(config, key, value)
                        self.stdout.write(f'Successfully updated configuration for {key}')
                    except Exception as e:
                        self.stdout.write(f'Error setting configuration for {key}: {e}')
                else:
                    self.stdout.write(f'Configuration key {key} does not exist')
