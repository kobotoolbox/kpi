from typing import Optional

from celery import shared_task

from ..integrations.misc import (
    GoogleTranslationEngineAsyncResult,
)


@shared_task
def handle_translation(
    submission_uuid: str,
    xpath: str,
    result: Optional[str] = None,
    _async: bool = False,
    *args,
    **kwargs
) -> None:
    if _async:
        result = GoogleTranslationEngineAsyncResult(
            submission_uuid=submission_uuid, *args, **kwargs
        ).result()
    with open('/tmp/translation-result.txt', 'a') as f:
        f.write(f'{result}\n')
