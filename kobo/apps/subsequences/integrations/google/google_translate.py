import posixpath
from datetime import date
from hashlib import md5

import constance
from django.conf import settings
from django.utils import timezone
from google.api_core.exceptions import InvalidArgument
from google.cloud import translate_v3 as translate, storage

from .google_transcribe import GoogleTransXEngine
from .utils import google_credentials_from_constance_config
from ..misc import (
    TranslationException,
)
from ...constants import GOOGLETX

MAX_SYNC_CHARS = 30720


def _hashed_strings(self, *strings):
    return md5(''.join(strings).encode()).hexdigest()[0:10]


class GoogleTranslationEngine(GoogleTransXEngine):
    def __init__(self):
        self.translate_client = translate.TranslationServiceClient(
            credentials=google_credentials_from_constance_config()
        )
        self.storage_client = storage.Client(
            credentials=google_credentials_from_constance_config()
        )
        self.translate_parent = (
            f'projects/{constance.config.ASR_MT_GOOGLE_PROJECT_ID}'
        )
        # "The global location is not supported for batch translation." See:
        # https://googleapis.dev/python/translation/2.0.0/gapic/v3/api.html
        # https://www.googlecloudcommunity.com/gc/AI-ML/location-variable-setting-for-the-Google-Cloud-Translation-API/m-p/543622/highlight/true#M1652
        self.translate_async_parent = (
            f'projects/{constance.config.ASR_MT_GOOGLE_PROJECT_ID}/'
            f'locations/{constance.config.ASR_MT_GOOGLE_TRANSLATION_LOCATION}'
        )
        self.bucket = self.storage_client.bucket(bucket_name=settings.GS_BUCKET_NAME)
        self.bucket_prefix = constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX

        super().__init__()
        self.date_string = date.today().isoformat()

    @property
    def counter_name(self):
        return 'google_mt_characters'

    def translation_must_be_async(self, content):
        return len(content) > MAX_SYNC_CHARS

    def translate_async(
        self,
        asset,
        submission_uuid: str,
        username: str,
        xpath: str,
        content: str,
        source_lang: str,
        target_lang: str,
    ):
        self.source_lang = source_lang
        self.target_lang = target_lang
        self.content = content
        self.asset = asset
        return self.handle_google_task_asynchronously(
            'translate',
            'v3',
            'projects.locations.operations',
            submission_uuid,
            username,
            xpath,
            source_lang,
            target_lang,
        )

    def begin_async_google_operation(
        self,
        submission_uuid,
        username,
        xpath,
        source_lang,
        target_lang,
    ) -> (object, int):
        _uniq_path = _hashed_strings(submission_uuid, xpath, username)
        _uniq_dir = f'{self.date_string}/{_uniq_path}/{source_lang}/{target_lang}/'
        source_path = posixpath.join(self.bucket_prefix, _uniq_dir, 'source.txt')
        self.output_dir = posixpath.join(self.bucket_prefix, _uniq_dir, 'completed/')

        dest = self.bucket.blob(source_path)
        if not dest.exists():
            dest.upload_from_string(self.content)


        req_params = {
            'parent': self.translate_async_parent,
            'source_language_code': self.source_lang,
            'target_language_codes': [self.target_lang],
            'input_configs': [{
                'gcs_source': {
                    'input_uri': f'gs://{settings.GS_BUCKET_NAME}/{source_path}'
                },
                'mime_type': 'text/plain',
            }],
            'output_config': {
                'gcs_destination': {
                    'output_uri_prefix': (
                        f'gs://{settings.GS_BUCKET_NAME}/{self.output_dir}'
                    )
                }
            },
            'labels': {
                'username': username,
                'submission': submission_uuid,
                # this needs to be lowercased to comply with google's API
                'xpath': xpath.lower(),
            },
        }

        response = self.translate_client.batch_translate_text(
            request=req_params
        )
        return (response, len(self.content))

        #     return {
        #         'operation_name': operation_name,
        #         'operation_dir': output_dir,
        #         'blob_name_includes': f'_{target_lang}_translations',
        #         'submission_uuid': submission_uuid,
        #         'xpath': xpath,
        #         'target_lang': target_lang,
        #     }

        # operation_client = operations_v1.OperationsClient(
        #     channel=translate_client.transport.grpc_channel,
        # )
        # operation = operation_client.get_operation(name=operation_name)
        # if operation.done:
        #     for blob in bucket.list_blobs(prefix=operation_dir):
        #         if blob_name_includes in blob.name:
        #             text = blob.download_as_text(),
        #             blob.delete()
        #         else:
        #             blob.delete()
        #     save_async_translation(text, submission_uuid, xpath, target_lang)

    def save_async_translation(self, text, submission_uuid, xpath, target_lang):
        from kobo.apps.subsequences.models import SubmissionExtras
        submission = SubmissionExtras.objects.get(submission_uuid=submission_uuid)
        submission.content[xpath][GOOGLETX] = {
            'status': 'complete',
            'languageCode': target_lang,
            'value': text,
        }
        submission.save()

    def append_operations_response(
        self,
        results,
        submission_uuid,
        username,
        xpath,
        source_lang,
        target_lang,
    ):
        _uniq_path = _hashed_strings(submission_uuid, xpath, username)
        _uniq_dir = f'{self.date_string}/{_uniq_path}/{source_lang}/{target_lang}/'
        output_dir = posixpath.join(self.bucket_prefix, _uniq_dir, 'completed/')
        text = None
        print(results)
        print(self.bucket.__dict__)
        for blob in self.bucket.list_blobs(prefix=output_dir):
            if f'_{target_lang}_translations' in blob.name:
                text = blob.download_as_text(),
                blob.delete()
            else:
                blob.delete()
        if not text:
            raise TranslationException
        self.save_async_translation(text, submission_uuid, xpath, target_lang)
        return (results, len(self.content))

    def append_api_response(self, results, *args):
        return self.append_operations_response(results, *args)



    def translate_sync(
        self,
        content: str,
        username: str,
        target_lang: str,
        source_lang: str,
    ) -> str:
        try:
            response = self.translate_client.translate_text(
                request={
                    'contents': [content],
                    'source_language_code': source_lang,
                    'target_language_code': target_lang,
                    'parent': self.translate_parent,
                    'mime_type': 'text/plain',
                    'labels': {'username': username},
                }
            )
        except InvalidArgument as e:
            raise TranslationException(e.message)
        return response.translations[0].translated_text
