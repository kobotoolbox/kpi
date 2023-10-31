from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.exceptions import ImproperlyConfigured
from djstripe.models import WebhookEndpoint
from model_bakery import baker

# Utilities for testing real Stripe API interactions (in test mode)


def check_stripe_configuration():
    """
    Make sure that Stripe is properly configured to run tests.
    We don't want to mingle live mode and test mode Stripe objects in
    the same DB, so tests that interact with Stripe API resources
    will only run if the *server* is in live mode.
    """
    if not settings.STRIPE_TEST_SECRET_KEY:
        raise ImproperlyConfigured("Couldn't find Stripe test key")
    if settings.STRIPE_LIVE_MODE:
        raise ImproperlyConfigured('Stripe is in live mode, only run these tests on a server in test mode')
    if not WebhookEndpoint.objects.all().exists():
        raise ImproperlyConfigured(
            'No Stripe webhook endpoint detected. Go to DJStripe -> Webhook Endpoints in the admin to set one up'
        )


def set_up_stripe():
    """
    Make sure Stripe is configured for testing, pull in the latest data from Stripe to our DB,
    and return a preconfigured user that's attached to a Customer in Stripe.
    This only syncs the minimum number of models we need for basic tests.
    If your test updates/creates additional models, call `djstripe_sync_models`
    with only those model names in your set_up_class method.
    """
    check_stripe_configuration()
    call_command('djstripe_sync_models', 'Customer', 'Price', 'Product', 'Subscription')
    return create_test_customer()


def create_test_customer():
    """
    All tests run on a single test customer object in Stripe:
    https://dashboard.stripe.com/test/customers/cus_Ouo1mXRxbHjV3T
    """
    someuser = User.objects.get(username='someuser')
    org = baker.make('Organization', id='org_this_is_a_test')
    org.add_user(someuser, is_admin=True)
    return someuser


def create_test_subscription(user: User):
    pass
