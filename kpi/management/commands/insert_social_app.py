import json
from django.core.management.base import BaseCommand
from allauth.socialaccount.models import SocialApp
from kobo.apps.accounts.models import SocialAppCustomData


class Command(BaseCommand):
    help = 'Insert a social app and related custom data'

    def add_arguments(self, parser):
        parser.add_argument(
            'provider', type=str, help='Either openid_connect or microsoft'
        )
        parser.add_argument(
            'provider_id', type=str, help='Provider ID used in the login url'
        )
        parser.add_argument(
            'name',
            type=str,
            help='Name of the organization displayed on the login page',
        )
        parser.add_argument(
            'client_id', type=str, help='App ID, or consumer key'
        )
        parser.add_argument(
            'secret',
            nargs='?',
            type=str,
            default='',
            help='API secret, client secret, or consumer secret',
        )
        parser.add_argument(
            'key',
            nargs='?',
            type=str,
            default='',
            help='Key provided by client',
        )
        parser.add_argument(
            'settings',
            type=str,
            help='Settings in json format enclosed with single quotes',
        )

    def handle(self, *args, **kwargs):
        provider = kwargs['provider']
        provider_id = kwargs['provider_id']
        name = kwargs['name']
        client_id = kwargs['client_id']
        secret = kwargs['secret']
        key = kwargs['key']
        settings_json = kwargs['settings']

        try:
            settings = json.loads(settings_json)
        except json.JSONDecodeError as e:
            self.stderr.write(
                f'Invalid JSON for settings: {e}'
            )
            return

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
            self.stdout.write(f'Successfully created social app for {social_app.name}')

        social_app_custom_data_exists = SocialAppCustomData.objects.filter(
            social_app=social_app
        ).exists()

        if not social_app_custom_data_exists:
            SocialAppCustomData.objects.create(
                social_app=social_app,
                is_public=True,
            )
            self.stdout.write(
                f'Successfully created custom data for {social_app.name}'
            )
        else:
            self.stdout.write(
                f'Custom data for {social_app.name} already exists'
            )
