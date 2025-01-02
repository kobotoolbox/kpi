
"""
Django runscript for Stripe configuration.

Usage:
    python manage.py runscript setup_stripe

Required Environment Variables:
    STRIPE_ENABLED=True
    STRIPE_LIVE_MODE=False  # or True for production
    STRIPE_TEST_SECRET_KEY=sk_test_...  # for test mode
    STRIPE_LIVE_SECRET_KEY=sk_live_...  # for live mode
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

logger = logging.getLogger(__name__)

def has_webhook_config():
    """Check if all webhook configuration is present"""
    return all([
        settings.DJSTRIPE_WEBHOOK_SECRET,
        settings.DJSTRIPE_WEBHOOK_URL,
        settings.DJSTRIPE_UUID,
        settings.DJSTRIPE_WEBHOOK_ID
    ])

def run(*args):
    if not settings.STRIPE_ENABLED:
        logger.info("Stripe is not enabled. Skipping configuration.")
        return

    try:
        # Set up Stripe API key based on mode
        stripe_key = settings.STRIPE_LIVE_SECRET_KEY if settings.STRIPE_LIVE_MODE else settings.STRIPE_TEST_SECRET_KEY
        if not stripe_key:
            logger.error("Stripe secret key not configured")
            return

        stripe.api_key = stripe_key
        
        # Run migrations
        call_command('migrate', 'djstripe')

        # Configure API Keys
        secret_key, _ = APIKey.objects.update_or_create(
            secret=stripe_key,
            defaults={
                'name': 'Live Secret Key' if settings.STRIPE_LIVE_MODE else 'Test Secret Key',
                'type': 'secret',
                'livemode': settings.STRIPE_LIVE_MODE
            }
        )

        # Handle webhook configuration
        if has_webhook_config():
            # Use existing webhook configuration
            webhook, created = WebhookEndpoint.objects.update_or_create(
                id=settings.DJSTRIPE_WEBHOOK_ID,
                defaults={
                    'url': settings.DJSTRIPE_WEBHOOK_URL,
                    'secret': settings.DJSTRIPE_WEBHOOK_SECRET,
                    'livemode': settings.STRIPE_LIVE_MODE,
                    'api_version': '2023-08-16',
                    'status': 'enabled',
                    'enabled_events': ['*'],
                    'djstripe_uuid': settings.DJSTRIPE_UUID,
                    'metadata': {
                        'djstripe_uuid': settings.DJSTRIPE_UUID
                    },
                    'djstripe_owner': 'Kobo, Inc'
                }
            )
            logger.info(f"Webhook endpoint {'created' if created else 'updated'} successfully.")

            # Sync webhook endpoint
            endpoints = stripe.WebhookEndpoint.list()
            for endpoint in endpoints.data:
                if endpoint.url == settings.DJSTRIPE_WEBHOOK_URL:
                    WebhookEndpoint.sync_from_stripe_data(endpoint)
                    logger.info(f"Synced webhook endpoint: {endpoint.url}")
            
            WebhookEndpoint.objects.exclude(url=settings.DJSTRIPE_WEBHOOK_URL).delete()
            
        else:
            # Create new webhook
            generated_uuid = str(uuid.uuid4())
            webhook_url = f"https://{settings.DOMAIN_NAME}/api/v2/stripe/webhook/{generated_uuid}/"
            
            webhook_data = stripe.WebhookEndpoint.create(
                url=webhook_url,
                enabled_events=["*"],
                metadata={'djstripe_uuid': generated_uuid}
            )
            
            webhook_endpoint = WebhookEndpoint.sync_from_stripe_data(webhook_data)
            webhook_endpoint.djstripe_uuid = generated_uuid
            webhook_endpoint.base_url = f"https://{settings.DOMAIN_NAME}"
            webhook_endpoint.metadata = {'djstripe_uuid': generated_uuid}
            webhook_endpoint.livemode = settings.STRIPE_LIVE_MODE
            webhook_endpoint.save()

            logger.info("New webhook created. Configure these values if you want to reuse this webhook:")
            logger.info(f"DJSTRIPE_WEBHOOK_SECRET={webhook_data.secret}")
            logger.info(f"DJSTRIPE_WEBHOOK_URL={webhook_url}")
            logger.info(f"DJSTRIPE_UUID={generated_uuid}")
            logger.info(f"DJSTRIPE_WEBHOOK_ID={webhook_data.id}")

        # Final sync
        call_command('djstripe_sync_models')
        logger.info("Stripe configuration completed.")

    except Exception as e:
        logger.error(f"Stripe configuration failed: {e}")
        raise