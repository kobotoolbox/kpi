# coding: utf-8
from datetime import timedelta

ACTIVE_STRIPE_STATUSES = [
    'active',
    'past_due',
    'trialing',
]

FREE_TIER_NO_THRESHOLDS = {
    'storage': None,
    'data': None,
    'transcription_minutes': None,
    'translation_chars': None,
}

FREE_TIER_EMPTY_DISPLAY = {
    'name': None,
    'feature_list': [],
}

ORGANIZATION_USAGE_MAX_CACHE_AGE = timedelta(minutes=15)

USAGE_LIMIT_MAP = {
    'characters': 'mt_characters',
    'seconds': 'asr_seconds',
    'storage': 'storage_bytes',
    'submission': 'submission',
}
