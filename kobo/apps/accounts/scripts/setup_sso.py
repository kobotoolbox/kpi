"""
Django runscript for Google SSO/OAuth configuration.

Usage:

# Enable SSO with all credentials
python manage.py runscript setup_sso \
    --script-args "client_id=client_id" \
    "client_secret=client_secret" \
    "social_app_name=social_app_name" \
    "provider_id=provider_id"

# Disable SSO (will skip configuration)
python manage.py runscript setup_sso --script-args google_auth_enabled=false
"""

import logging
import sys
import os
from allauth.socialaccount.models import SocialApp


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def parse_script_args():
    args = {}
    for arg in sys.argv[2:]:
        if '=' in arg:
            key, value = arg.split('=', 1)
            if value.startswith(f'{key}='):
                value = value.split('=', 1)[1]
            args[key] = value
    return args


def run(
        client_id=None,
        client_secret=None,
        social_app_name=None,
        provider_id=None,
        google_auth_enabled=None
        ):
    """Setup Google SSO configuration."""
    parsed_args = parse_script_args()

    google_auth_enabled = parsed_args.get('google_auth_enabled', google_auth_enabled)
    client_id = parsed_args.get('client_id', client_id)
    client_secret = parsed_args.get('client_secret', client_secret)
    social_app_name = parsed_args.get('social_app_name', social_app_name)
    provider_id = parsed_args.get('provider_id', provider_id)

    logger.debug(
        f'Raw arguments - client_id: {client_id}, client_secret: {client_secret}, '
        f'social_app_name: {social_app_name}, provider_id: {provider_id}, '
        f'google_auth_enabled: {google_auth_enabled}')

    if google_auth_enabled is not None:
        google_auth_enabled = str(google_auth_enabled).lower() in ['true', '1', 'yes']
    else:
        env_google_auth_enabled = os.environ.get('GOOGLE_AUTH_ENABLED', 'false')
        google_auth_enabled = env_google_auth_enabled.lower() in ['true', '1', 'yes']

    logger.info(
        f'Google auth status: {"Enabled" if google_auth_enabled else "Disabled"}'
    )

    if not google_auth_enabled:
        logger.info('Google authentication is disabled.')
        return

    if not all([client_id, client_secret, social_app_name, provider_id]):
        logger.error(
            'All args required when google_auth_enabled=True'
        )
        return

    try:
        social_app, created = SocialApp.objects.update_or_create(
            provider='openid_connect',
            defaults={
                'name': social_app_name,
                'provider_id': provider_id,
                'client_id': client_id,
                'secret': client_secret,
                'settings': {
                    'server_url': (
                        'https://accounts.google.com/.well-known/openid-configuration'
                    )
                }
            }
        )
        status = 'created' if created else 'updated'
        logger.info(f'Social application {social_app_name} {status} successfully')
        logger.info(f'Provider ID: {provider_id}')
        logger.info('SSO configuration completed successfully.')

    except Exception as e:
        logger.error(f'SSO configuration failed: {e}')
        raise
