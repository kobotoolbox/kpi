from datetime import date
from hashlib import md5

from google.api_core.exceptions import InvalidArgument
from google.cloud import translate_v3 as translate, storage

from .utils import google_credentials_from_constance_config
from ..misc import (
    TranslationException,
)

BUCKET_NAME = 'kobo-translations-test-qwerty12345'
GS_URI = f'gs://${BUCKET_NAME}'
EXTENSION = '.txt'
LOCATION = 'us-central1'
MAX_SYNC_CHARS = 30720
PROJECT_ID = 'kobo-nlp-asr-mt'
PARENT = f'projects/{PROJECT_ID}'
PARENT_ASYNC = f'projects/{PROJECT_ID}/locations/{LOCATION}'
SOURCE_BASENAME = 'source'
COST_PER_CHAR = 20 / 1000000  # https://cloud.google.com/translate/pricing


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
        self.bucket = self.storage_client.bucket(bucket_name=BUCKET_NAME)

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
        source_path = f'{_uniq_dir}/source.txt'
        output_dir = f'{_uniq_dir}/completed/'

        dest = self.bucket.blob(source_path)
        if not dest.exists():
            dest.upload_from_string(content)

        req_params = {
            'parent': PARENT_ASYNC,
            'source_language_code': source_lang,
            'target_language_codes': [target_lang],
            'input_configs': [{
                'gcs_source': {
                    'input_uri': f'gs://{BUCKET_NAME}/{source_path}'
                },
                'mime_type': 'text/plain',
            }],
            'output_config': {
                'gcs_destination': {
                    'output_uri_prefix': f'gs://{BUCKET_NAME}/{output_dir}'
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
            'name': operation_name,
            'dir': output_dir,
            'target_lang': target_lang,
            'blob_name_includes': f'_{target_lang}_translations',
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
                    'parent': PARENT,
                    'mime_type': 'text/plain',
                    'labels': {'username': username},
                }
            )
        except InvalidArgument as e:
            raise TranslationException(e.message)
        return response.translations[0].translated_text
