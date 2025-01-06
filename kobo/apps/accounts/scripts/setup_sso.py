"""
Django runscript for Google SSO/OAuth configuration.

Usage:
    python manage.py runscript setup_sso

if GOOGLE_AUTH_ENABLED=True
  Required environment variables
    SOCIAL_APP_NAME=social-app-name
    SOCIAL_APP_PROVIDER_ID=provider-id
    GOOGLE_CLIENT_ID=client-id
    GOOGLE_CLIENT_SECRET=client-secret

Note:
    - Creates or updates the Google OpenID Connect configuration in Django allauth
    - Configuration can be viewed/managed in Django admin under Social Applications
"""

import logging
from django.conf import settings
from allauth.socialaccount.models import SocialApp


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run(*args):
    if not settings.GOOGLE_AUTH_ENABLED:
        logger.info("Google Auth is not enabled. Skipping configuration.")
        return

    if not all([settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET]):
        logger.error("Google OAuth credentials not configured")
        return

    try:
        social_app, created = SocialApp.objects.update_or_create(
            provider='openid_connect',
            defaults={
                'name': settings.SOCIAL_APP_NAME,
                'provider_id': settings.SOCIAL_APP_PROVIDER_ID,
                'client_id': settings.GOOGLE_CLIENT_ID,
                'secret': settings.GOOGLE_CLIENT_SECRET,
                'settings': {
                    'server_url': (
                        'https://accounts.google.com/.well-known/openid-configuration'
                    )
                }
            }
        )
        status = 'created' if created else 'updated'
        logger.info(
            f"Social application '{settings.SOCIAL_APP_NAME}' {status} successfully"
        )
        logger.info(f"Provider ID: {settings.SOCIAL_APP_PROVIDER_ID}")
        logger.info("SSO configuration completed successfully.")

    except Exception as e:
        logger.error(f"SSO configuration failed: {e}")
        raise
