from __future__ import annotations

import requests
from django.conf import settings

from kobo.celery import celery_app


class LocalServiceError(Exception):
    """
    A local NLP server (LLM or speech-to-text) could not be reached, or its
    answer was unusable
    """


def must_defer_to_worker() -> bool:
    """
    Whether a slow local job must wait for a Celery worker instead of running in
    the current process. On a CPU-only box transcribing or translating can take
    minutes, longer than a request may run. With `CELERY_TASK_ALWAYS_EAGER` there
    are no workers, so jobs run right away.
    """
    return not (celery_app.current_worker_task or settings.CELERY_TASK_ALWAYS_EAGER)


def _post(url: str, read_timeout: int | None, **kwargs) -> dict:
    try:
        response = requests.post(
            url,
            timeout=(
                settings.LOCAL_LLM_CONNECT_TIMEOUT,
                read_timeout or settings.LOCAL_LLM_READ_TIMEOUT,
            ),
            **kwargs,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        raise LocalServiceError(str(e)) from e


def chat_completion(body: dict, read_timeout: int | None = None) -> dict:
    """
    POST `body` to the OpenAI-compatible `/v1/chat/completions` endpoint at
    `LOCAL_LLM_URL` (e.g. llama.cpp's llama-server) and return the decoded
    response
    """
    url = f'{settings.LOCAL_LLM_URL.rstrip("/")}/v1/chat/completions'
    return _post(url, read_timeout, json=body)


def get_message_content(response_body: dict) -> str:
    """
    Return the text of the first choice in a chat completion response
    """
    try:
        content = response_body['choices'][0]['message']['content']
    except (IndexError, KeyError, TypeError) as e:
        raise LocalServiceError(f'Unexpected response from the local LLM: {e!r}') from e
    if content is None:
        raise LocalServiceError('The local LLM returned an empty response')
    return content


def transcribe(
    audio: bytes,
    filename: str,
    language: str,
    read_timeout: int | None = None,
) -> str:
    """
    POST audio to the OpenAI-compatible `/v1/audio/transcriptions` endpoint at
    `LOCAL_WHISPER_URL` (e.g. whisper.cpp's whisper-server) and return the text
    """
    url = f'{settings.LOCAL_WHISPER_URL.rstrip("/")}/v1/audio/transcriptions'
    response_body = _post(
        url,
        read_timeout,
        files={'file': (filename, audio)},
        data={'language': language, 'response_format': 'json', 'temperature': '0'},
    )
    try:
        return response_body['text']
    except (KeyError, TypeError) as e:
        raise LocalServiceError(
            f'Unexpected response from the local speech-to-text server: {e!r}'
        ) from e
