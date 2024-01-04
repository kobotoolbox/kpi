# coding: utf-8
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
