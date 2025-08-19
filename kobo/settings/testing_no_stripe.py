from .testing import *  # noqa
STRIPE_ENABLED = False
INSTALLED_APPS = tuple(
    filter(
        lambda x: x not in ['djstripe', 'kobo.apps.stripe'], INSTALLED_APPS  # noqa F405
    )
)
