from __future__ import annotations

import requests
from django.conf import settings


class LocalLLMError(Exception):
    """
    The local LLM server could not be reached, or its answer was unusable
    """


def chat_completion(body: dict, read_timeout: int | None = None) -> dict:
    """
    POST `body` to the OpenAI-compatible `/v1/chat/completions` endpoint at
    `LOCAL_LLM_URL` (e.g. llama.cpp's llama-server) and return the decoded
    response
    """
    url = f'{settings.LOCAL_LLM_URL.rstrip("/")}/v1/chat/completions'
    try:
        response = requests.post(
            url,
            json=body,
            timeout=(
                settings.LOCAL_LLM_CONNECT_TIMEOUT,
                read_timeout or settings.LOCAL_LLM_READ_TIMEOUT,
            ),
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise LocalLLMError(str(e)) from e


def get_message_content(response_body: dict) -> str:
    """
    Return the text of the first choice in a chat completion response
    """
    try:
        content = response_body['choices'][0]['message']['content']
    except (IndexError, KeyError, TypeError) as e:
        raise LocalLLMError(f'Unexpected response from the local LLM: {e!r}') from e
    if content is None:
        raise LocalLLMError('The local LLM returned an empty response')
    return content
