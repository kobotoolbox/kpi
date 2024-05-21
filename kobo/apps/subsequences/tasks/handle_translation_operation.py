from celery import shared_task
from django.conf import settings
from google.api_core import operations_v1
from google.cloud import translate_v3 as translate, storage

from ..constants import (
    GOOGLETX,
    ASYNC_TRANSLATION_DELAY_INTERVAL,
)
from ..integrations.google.utils import google_credentials_from_constance_config

# TODO: Transcriptions take a different approach that has the benefit of
# avoiding Celery, by contacting Google only when the browser polls for
# updates:
# https://github.com/kobotoolbox/kpi/blob/d3b81c6d1a647c3676c0cc0affada8979d8f5112/kobo/apps/subsequences/integrations/google/google_transcribe.py#L89
# However, this means that someone starting an async job, closing
# their browser, and coming back too late (1+ day later?) would never get their
# results. The pros and cons of each approach need to be evaluated, and a
# standard approach needs to be adopted for both transcriptions and
# translations —jnm 20240403

@shared_task
def handle_google_translation_operation(
    operation_name: str,
    operation_dir: str,
    blob_name_includes: str,
    submission_uuid: str,
    xpath: str,
    target_lang: str,
) -> None:
    translate_client = translate.TranslationServiceClient(
        credentials=google_credentials_from_constance_config()
    )
    storage_client = storage.Client(
        credentials=google_credentials_from_constance_config()
    )
    bucket = storage_client.bucket(bucket_name=settings.GS_BUCKET_NAME)
    operation_client = operations_v1.OperationsClient(
        channel=translate_client.transport.grpc_channel,
    )
    operation = operation_client.get_operation(name=operation_name)
    if operation.done:
        for blob in bucket.list_blobs(prefix=operation_dir):
            if blob_name_includes in blob.name:
                text = blob.download_as_text(),
                blob.delete()
            else:
                blob.delete()
        save_async_translation(text, submission_uuid, xpath, target_lang)
    else:
        # check back again later
        handle_google_translation_operation.apply_async((
            operation_name,
            operation_dir,
            blob_name_includes,
            submission_uuid,
            xpath,
            target_lang,
        ), countdown=ASYNC_TRANSLATION_DELAY_INTERVAL)


def save_async_translation(text, submission_uuid, xpath, target_lang):
    from kobo.apps.subsequences.models import SubmissionExtras
    submission = SubmissionExtras.objects.get(submission_uuid=submission_uuid)
    submission.content[xpath][GOOGLETX] = {
        'status': 'complete',
        'languageCode': target_lang,
        'value': text,
    }
    submission.save()
