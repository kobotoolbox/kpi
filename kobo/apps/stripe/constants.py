# coding: utf-8
from datetime import timedelta

ACTIVE_STRIPE_STATUSES = [
    'active',
    'past_due',
    'trialing',
]

ORGANIZATION_USAGE_MAX_CACHE_AGE = timedelta(minutes=15)
