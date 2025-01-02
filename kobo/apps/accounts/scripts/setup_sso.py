"""
Django runscript for Google SSO/OAuth configuration.

Usage:
    python manage.py runscript setup_sso

Required Environment Variables:
    GOOGLE_AUTH_ENABLED=True
    GOOGLE_CLIENT_ID=your-client-id
    GOOGLE_CLIENT_SECRET=your-client-secret

Note:
    - Creates or updates the Google OpenID Connect configuration in Django allauth
    - Configuration can be viewed/managed in Django admin under Social Applications
"""

import logging
from django.conf import settings
from allauth.socialaccount.models import SocialApp

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
                'name': 'Kobo Google Apps',
                'provider_id': 'kobo-inc',
                'client_id': settings.GOOGLE_CLIENT_ID,
                'secret': settings.GOOGLE_CLIENT_SECRET,
                'settings': {
                    'server_url': 'https://accounts.google.com/.well-known/openid-configuration'
                }
            }
        )
        logger.info("SSO configuration completed.")

    except Exception as e:
        logger.error(f"SSO configuration failed: {e}")
        raise