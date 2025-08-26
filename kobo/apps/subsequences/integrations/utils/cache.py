from ...constants import SUBSEQUENCES_ASYNC_CACHE_KEY


# TODO REMOVE ME, I'm not used anymore
def generate_cache_key(
    user_id: int, submission_uuid: str, xpath: str, source_lang: str, target_lang: str
) -> str:
    """
    Make a cache key from the parameters for NLP
    """
    args = [user_id, submission_uuid, xpath, source_lang, target_lang]
    return '-'.join(map(str, [SUBSEQUENCES_ASYNC_CACHE_KEY, *args]))
