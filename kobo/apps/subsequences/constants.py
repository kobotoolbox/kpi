GOOGLETX = 'googletx'
GOOGLETS = 'googlets'

ASYNC_TRANSLATION_DELAY_INTERVAL = 5

SUBSEQUENCES_ASYNC_CACHE_KEY = 'subsequences'
# Google speech api limits audio to ~480 Minutes*
# Processing time is not audio length, but it's an estimate
GOOGLE_CACHE_TIMEOUT = 28800  # 8 hours


def make_async_cache_key(*args: str):
    return '-'.join([SUBSEQUENCES_ASYNC_CACHE_KEY, *args])
