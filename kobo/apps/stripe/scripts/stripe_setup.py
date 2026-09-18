"""
Django runscript for Stripe configuration.

Usage:
    python manage.py runscript stripe_setup

Required Environment Variables:
    STRIPE_ENABLED=True
    STRIPE_LIVE_MODE=False  # or True for production
    STRIPE_TEST_SECRET_KEY=sk_test_...  # for test mode
    STRIPE_LIVE_SECRET_KEY=sk_live_...  # for live mode

Required only for new webhook creation:
    DOMAIN_NAME=yourdomain.com

Optional Webhook Environment Variables (all required if any are set):
    DJSTRIPE_WEBHOOK_SECRET=whsec_...
    DJSTRIPE_WEBHOOK_URL=https://...
    DJSTRIPE_UUID=...
    DJSTRIPE_WEBHOOK_ID=we_...

Note:
    - If webhook variables are not set, a new webhook will be created
    - If webhook variables are set, an existing webhook configuration will be used
"""
import logging
import uuid
from django.conf import settings
from django.core.management import call_command
from djstripe.models import APIKey, WebhookEndpoint
import stripe


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def has_webhook_config():
    """Check if all webhook configuration is present"""
    config_present = all([
        settings.DJSTRIPE_WEBHOOK_SECRET,
        settings.DJSTRIPE_WEBHOOK_URL,
        settings.DJSTRIPE_UUID,
        settings.DJSTRIPE_WEBHOOK_ID
    ])
    logger.info(f'Webhook config present: {config_present}')
    return config_present


def sync_webhooks(url):
    """Sync webhooks from Stripe API to local database."""
    endpoints = stripe.WebhookEndpoint.list()
    for endpoint in endpoints.data:
        if endpoint.url == url:
            WebhookEndpoint.sync_from_stripe_data(endpoint)
            logger.info(f'Synced webhook endpoint: {endpoint.url}')

    WebhookEndpoint.objects.exclude(url=url).delete()
    logger.info(f'Deleted any webhook not matching URL: {url}')


def configure_api_keys(stripe_key, stripe_public_key):
    """Configure and update Stripe API keys."""
    mode = 'Live' if settings.STRIPE_LIVE_MODE else 'Test'
    for key_data in [
        {'secret': stripe_key, 'name': 'Secret Key', 'type': 'secret'},
        {'secret': stripe_public_key, 'name': 'Public Key', 'type': 'publishable'}
    ]:
        key, created = APIKey.objects.update_or_create(
            secret=key_data['secret'],
            defaults={
                'name': f"{mode} {key_data['name']}",
                'type': key_data['type'],
                'livemode': settings.STRIPE_LIVE_MODE
            }
        )
        logger.info(f"{key_data['name']} {'created' if created else 'updated'}")


def run(*args):
    logger.info('Starting Stripe setup script')

    if not settings.STRIPE_ENABLED:
        logger.info('Stripe is not enabled. Skipping configuration.')
        return

    try:
        if settings.STRIPE_LIVE_MODE:
            stripe_key = settings.STRIPE_LIVE_SECRET_KEY
            stripe_public_key = settings.STRIPE_LIVE_PUBLIC_KEY
        else:
            stripe_key = settings.STRIPE_TEST_SECRET_KEY
            stripe_public_key = settings.STRIPE_TEST_PUBLIC_KEY

        if not all([stripe_key, stripe_public_key]):
            logger.error('Stripe API keys not configured')
            return

        stripe.api_key = stripe_key
        logger.info('Running migrations...')
        call_command('migrate', 'djstripe')

        # Configure API keys
        configure_api_keys(stripe_key, stripe_public_key)

        # Handle webhook configuration
        if has_webhook_config():
            webhook_url = settings.DJSTRIPE_WEBHOOK_URL
            WebhookEndpoint.objects.update_or_create(
                id=settings.DJSTRIPE_WEBHOOK_ID,
                defaults={
                    'url': webhook_url,
                    'secret': settings.DJSTRIPE_WEBHOOK_SECRET,
                    'livemode': settings.STRIPE_LIVE_MODE,
                    'api_version': '2023-08-16',
                    'status': 'enabled',
                    'enabled_events': ['*'],
                    'djstripe_uuid': settings.DJSTRIPE_UUID,
                    'metadata': {'djstripe_uuid': settings.DJSTRIPE_UUID}
                }
            )
            logger.info('Webhook endpoint updated successfully.')
            sync_webhooks(webhook_url)

        else:
            logger.info('Creating new webhook...')
            if not getattr(settings, 'DOMAIN_NAME', None):
                logger.error('DOMAIN_NAME is required for creating a new webhook')
                return

            generated_uuid = str(uuid.uuid4())
            domain = settings.DOMAIN_NAME
            webhook_path = f'/api/v2/stripe/webhook/{generated_uuid}/'
            webhook_url = f'https://{domain}{webhook_path}'
            webhook_data = stripe.WebhookEndpoint.create(
                url=webhook_url,
                enabled_events=['*'],
                metadata={'djstripe_uuid': generated_uuid}
            )

            WebhookEndpoint.sync_from_stripe_data(webhook_data)
            WebhookEndpoint.objects.filter(url=webhook_url).update(
                djstripe_uuid=generated_uuid,
                url=f'https://{settings.DOMAIN_NAME}',
                metadata={'djstripe_uuid': generated_uuid},
                livemode=settings.STRIPE_LIVE_MODE
            )

            logger.info('New webhook created')
            logger.info(f'DJSTRIPE_WEBHOOK_URL={webhook_url}')
            logger.info(f'DJSTRIPE_UUID={generated_uuid}')
            logger.info(f'DJSTRIPE_WEBHOOK_ID={webhook_data.id}')

            call_command('djstripe_sync_models')
            sync_webhooks(webhook_url)

        logger.info('Stripe configuration completed successfully.')

    except stripe.error.StripeError as e:
        logger.error(f'Stripe API error: {e}')
        raise
    except Exception as e:
        logger.error(f'General error: {e}')
        raise
