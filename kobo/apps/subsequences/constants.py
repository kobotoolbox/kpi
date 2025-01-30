# Could allow more types in the future? See
# formpack.utils.replace_aliases.MEDIA_TYPES
TRANSCRIBABLE_SOURCE_TYPES = ['audio', 'video', 'background-audio']
TRANSLATABLE_SOURCE_TYPES = TRANSCRIBABLE_SOURCE_TYPES + ['text']
QUAL_SOURCE_TYPES = TRANSLATABLE_SOURCE_TYPES

GOOGLETX = 'googletx'
GOOGLETS = 'googlets'
GOOGLE_CODE = 'goog'

ASYNC_TRANSLATION_DELAY_INTERVAL = 5

SUBSEQUENCES_ASYNC_CACHE_KEY = 'subsequences'
# Google speech api limits audio to ~480 Minutes*
# Processing time is not audio length, but it's an estimate
GOOGLE_CACHE_TIMEOUT = 28800  # 8 hours


def make_nlp_async_cache_key(
    user_id: int,
    submission_uuid: str,
    xpath: str,
    source_lang: str,
    target_lang: str
) -> str:
    """
    Make a cache key from the parameters for NLP
    """
    args = [user_id, submission_uuid, xpath, source_lang, target_lang]
    return '-'.join(map(str, [SUBSEQUENCES_ASYNC_CACHE_KEY, *args]))
