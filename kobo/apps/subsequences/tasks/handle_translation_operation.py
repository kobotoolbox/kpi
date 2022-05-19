from celery import shared_task
from google.api_core import operations_v1
from google.cloud import translate_v3 as translate, storage

from kobo.apps.subsequences.constants import GOOGLETX

BUCKET_NAME = 'kobo-translations-test-qwerty12345'
DELAY_INTERVAL = 5


@shared_task
def handle_google_translation_operation(
    operation_name: str,
    operation_dir: str,
    blob_name_includes: str,

    submission_uuid: str,
    xpath: str,
    target_lang: str,
) -> None:
    translate_client = translate.TranslationServiceClient()
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name=BUCKET_NAME)
    operation_client = operations_v1.OperationsClient(
        channel=translate_client.transport.grpc_channel
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
        # check back in DELAY_INTERVAL seconds
        handle_google_translation_operation.apply_async((
            operation_name,
            operation_dir,
            target_lang,
            blob_name_includes,
        ), countdown=DELAY_INTERVAL)


def save_async_translation(text, submission_uuid, xpath, target_lang):
    from kobo.apps.subsequences.models import SubmissionExtras
    submission = SubmissionExtras.objects.get(uuid=submission_uuid)
    submission.content[xpath][GOOGLETX] = {
        'status': 'complete',
        'languageCode': target_lang,
        'value': text,
    }
    submission.save()
