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
            'config_key', type=str, help='Configuration key to update'
        )
        config_parser.add_argument(
            'config_value', type=str, help='New value for the configuration key'
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
        config_key = kwargs['config_key']
        config_value = kwargs['config_value']

        if hasattr(config, config_key):
            setattr(config, config_key, config_value)
            self.stdout.write(
                f'Successfully updated configuration for {config_key}'
            )
        else:
            self.stdout.write(f'Configuration key {config_key} does not exist')
