import functools

from django.apps import apps
from django.conf import settings


def requires_stripe(func):
    """
    Decorator for methods that rely either on models from Stripe packages or
    stripe-related database fields

    Any method that calls a @requires_stripe-decorated method should either be
    decorated itself, or enclose the method in an if settings.STRIPE_ENABLED block
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if not settings.STRIPE_ENABLED:
            raise NotImplementedError(
                f'Cannot call {func.__name__} with stripe disabled'
            )
        else:
            from djstripe.models import (
                Charge,
                PaymentIntent,
                Price,
                Product,
                Subscription,
            )

            PlanAddOn = apps.get_model('stripe', 'PlanAddOn')
            ExceededLimitCounter = apps.get_model('stripe', 'ExceededLimitCounter')

            kwargs['product_model'] = Product
            kwargs['subscription_model'] = Subscription
            kwargs['price_model'] = Price
            kwargs['charge_model'] = Charge
            kwargs['payment_intent_model'] = PaymentIntent
            kwargs['exceeded_limit_counter_model'] = ExceededLimitCounter
            kwargs['plan_add_on_model'] = PlanAddOn

            return func(*args, **kwargs)

    return wrapper
