from typing import Optional

from celery import shared_task


@shared_task
def handle_translation(
    submission_uuid: str,
    xpath: str,
    result: Optional[str] = None,
    _async: bool = False,
    *args,
    **kwargs,
) -> None:
    from kobo.apps.subsequences.integrations.misc import (
        GoogleTranslationEngineAsyncResult,
    )

    if _async:
        result = GoogleTranslationEngineAsyncResult(
            submission_uuid=submission_uuid,
            *args,
            **kwargs
        ).result()

    # do something with the result
    with open('/tmp/translation-result.txt', 'a') as f:
        f.write(f'{submission_uuid}, {xpath}, {result}\n')

@shared_task
def handle_transcript(submission_uuid, xpath, result):
    # this is where we will store the transcript in the SubmissionExtras model
    pass
