GOOGLETX = 'googletx'
GOOGLETS = 'googlets'

SUBSEQUENCES_ASYNC_CACHE_KEY = 'subsequences'
# Google speech api limits audio to ~480 Minutes*
# Processing time is not audio length, but it's an estimate
GOOGLE_CACHE_TIMEOUT = 28800  # 8 hours

def make_async_cache_key(user_id: int, submission_id: str, xpath: str, source: str):
    return f'{SUBSEQUENCES_ASYNC_CACHE_KEY}-{user_id}-{submission_id}-{xpath}-{source}'
