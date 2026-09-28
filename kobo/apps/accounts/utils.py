import logging
import requests
import constance
from django.conf import settings

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES

logger = logging.getLogger(__name__)


def user_has_inactive_paid_subscription(username):
    if not settings.STRIPE_ENABLED:
        return False

    return (
        User.objects.filter(
            username=username,
            organizations_organization__djstripe_customers__subscriptions__items__price__unit_amount__gt=0,
        )
        .exclude(
            organizations_organization__djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        )
        .exists()
    )


def user_has_paid_subscription(username):
    if not settings.STRIPE_ENABLED:
        return False

    return User.objects.filter(
        username=username,
        organizations_organization__djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        organizations_organization__djstripe_customers__subscriptions__items__price__unit_amount__gt=0,
    ).exists()


def validate_turnstile(token, remote_ip=None):
    """
    Validate the Cloudflare Turnstile token by making a POST request to Cloudflare's siteverify API.
    """
    if not constance.config.TURNSTILE_ENABLED:
        return True

    if not token:
        return False

    secret_key = constance.config.TURNSTILE_SECRET_KEY
    if not secret_key:
        logger.warning("Turnstile is enabled but TURNSTILE_SECRET_KEY is not configured.")
        return False

    data = {
        'secret': secret_key,
        'response': token,
    }
    if remote_ip:
        data['remoteip'] = remote_ip

    try:
        response = requests.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data=data,
            timeout=5
        )
        if response.status_code == 200:
            result = response.json()
            return result.get('success', False)
        else:
            logger.error(
                f"Turnstile siteverify returned status code {response.status_code}: {response.text}"
            )
            return False
    except requests.RequestException as e:
        logger.error(f"Turnstile siteverify request failed: {e}")
        return False
