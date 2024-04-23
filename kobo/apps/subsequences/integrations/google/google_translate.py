import posixpath
from datetime import date
from hashlib import md5

import constance
from django.conf import settings
from google.api_core.exceptions import InvalidArgument
from google.cloud import translate_v3 as translate, storage

from .utils import google_credentials_from_constance_config
from ..misc import (
    TranslationException,
)

MAX_SYNC_CHARS = 30720


def _hashed_strings(self, *strings):
    return md5(''.join(strings).encode()).hexdigest()[0:10]


class GoogleTranslationEngine:
    def __init__(self):
        self.translate_client = translate.TranslationServiceClient(
            credentials=google_credentials_from_constance_config()
        )
        self.storage_client = storage.Client(
            credentials=google_credentials_from_constance_config()
        )
        self.bucket = self.storage_client.bucket(
            bucket_name=settings.GS_BUCKET_NAME
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

        super().__init__()
        self.date_string = date.today().isoformat()

    def translate(self, *args, **kwargs):
        raise NotImplementedError('moved to translate_sync and translate_async')

    def translation_must_be_async(self, content):
        return len(content) > MAX_SYNC_CHARS

    def translate_async(
        self,
        submission_uuid: str,
        username: str,
        xpath: str,
        content: str,
        source_lang: str,
        target_lang: str,
    ) -> str:
        self.submission_uuid = submission_uuid
        self.username = username
        self.xpath = xpath
        _uniq_path = _hashed_strings(self.submission_uuid, self.xpath)
        _uniq_dir = f'{self.date_string}/{_uniq_path}'
        bucket_prefix = constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX
        source_path = posixpath.join(bucket_prefix, _uniq_dir, 'source.txt')
        output_dir = posixpath.join(bucket_prefix, _uniq_dir, 'completed/')

        dest = self.bucket.blob(source_path)
        if not dest.exists():
            dest.upload_from_string(content)

        req_params = {
            'parent': self.translate_async_parent,
            'source_language_code': source_lang,
            'target_language_codes': [target_lang],
            'input_configs': [{
                'gcs_source': {
                    'input_uri': f'gs://{settings.GS_BUCKET_NAME}/{source_path}'
                },
                'mime_type': 'text/plain',
            }],
            'output_config': {
                'gcs_destination': {
                    'output_uri_prefix': (
                        f'gs://{settings.GS_BUCKET_NAME}/{output_dir}'
                    )
                }
            },
            'labels': {
                'username': self.username,
                'submission': self.submission_uuid,
                'xpath': self.xpath,
            },
        }
        operation = self.translate_client.batch_translate_text(
            request=req_params
        ).operation
        operation_name = operation.name
        return {
            'operation_name': operation_name,
            'operation_dir': output_dir,
            'blob_name_includes': f'_{target_lang}_translations',
            'submission_uuid': submission_uuid,
            'xpath': xpath,
            'target_lang': target_lang,
        }

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
