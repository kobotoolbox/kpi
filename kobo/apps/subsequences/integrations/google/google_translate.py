import time
from typing import (
    Dict,
    List,
    Optional,
    Union,
)

from google.api_core.exceptions import InvalidArgument

from ..misc import (
    GoogleTranslationBase,
    TranslationEngineBase,
    TranslationException,
)
from kobo.apps.subsequences.tasks.handle_translation import handle_translation


BUCKET_NAME = 'kobo-translations-test-qwerty12345'
EXTENSION = '.txt'
LOCATION = 'us-central1'
MAX_SYNC_CHARS = 30720
PROJECT_ID = 'kobo-nlp-asr-mt'
SOURCE_BASENAME = 'source'
COST = 20 / 1000000  # https://cloud.google.com/translate/pricing


class GoogleTranslationEngine(TranslationEngineBase, GoogleTranslationBase):
    def __init__(self):
        super().__init__()
        self.parent = f'projects/{PROJECT_ID}'
        self.mime_type = 'text/plain'
        self.uri_base = f'gs://{BUCKET_NAME}'
        self.parent_async = f'projects/{PROJECT_ID}/locations/{LOCATION}'
        self.state = 'BARDO'
        self.cost = 0

    def get_languages(
        self, labels: bool = False, display_language: str = 'en'
    ) -> Union[Dict, List]:
        response = self.translate_client.get_supported_languages(
            parent=self.parent, display_language_code=display_language
        )
        if labels:
            return {
                lang.language_code: lang.display_name
                for lang in response.languages
            }
        return [lang.language_code for lang in response.languages]

    def translate(
        self,
        content: str,
        submission_uuid: str,
        username: str,
        xpath: str,
        force_async: bool = False,
        *args: List,
        **kwargs: Dict
    ) -> str:

        self.submission_uuid = submission_uuid
        self.username = username
        self.xpath = xpath

        if len(content) < MAX_SYNC_CHARS and not force_async:
            return self._translate_sync(content, *args, **kwargs)
        return self._translate_async(content, *args, **kwargs)

    def _calculate_cost(self, chars: int) -> None:
        self.cost = COST * chars

    def _get_output_filename(self, output_path: str) -> str:
        username, submission_uuid, target_lang, _ = output_path.split('/')
        return output_path + '_'.join(
            [
                BUCKET_NAME,
                username,
                submission_uuid,
                SOURCE_BASENAME,
                target_lang,
                f'translations{EXTENSION}',
            ]
        )

    def _store_content(self, content: str, path: str) -> bool:
        dest = self.bucket.blob(path)
        dest.upload_from_string(content)
        return True

    def _translate_async(
        self,
        content: str,
        source_lang: str,
        target_lang: str,
    ) -> str:

        source_path = f'{self.username}/{self.submission_uuid}/{SOURCE_BASENAME}{EXTENSION}'
        output_path = f'{self.username}/{self.submission_uuid}/{target_lang}/'

        storage_response = self._store_content(content, source_path)

        if not storage_response:
            raise TranslationException('Unable to store content in GCP')

        input_uri = f'{self.uri_base}/{source_path}'
        output_uri = f'{self.uri_base}/{output_path}'
        self.output_filename = self._get_output_filename(output_path)

        input_configs_element = {
            'gcs_source': {'input_uri': input_uri},
            'mime_type': self.mime_type,
        }
        output_config = {'gcs_destination': {'output_uri_prefix': output_uri}}

        self._calculate_cost(chars=len(content))
        self.operation = self.translate_client.batch_translate_text(
            request={
                'parent': self.parent_async,
                'source_language_code': source_lang,
                'target_language_codes': [target_lang],
                'input_configs': [input_configs_element],
                'output_config': output_config,
                'labels': {'user': self.username},
            }
        )
        self.state = 'RUNNING'
        task = handle_translation.delay(
            submission_uuid=self.submission_uuid,
            xpath=self.xpath,
            operation_name=self.operation.operation.name,
            output_filename=self.output_filename,
            username=self.username,
            _async=True
        )
        return task.id

    def _translate_sync(
        self,
        content: str,
        target_lang: str,
        source_lang: Optional[str] = None,
        *args: List,
        **kwargs: Dict,
    ) -> str:
        try:
            response = self.translate_client.translate_text(
                request={
                    'contents': [content],
                    'source_language_code': source_lang,
                    'target_language_code': target_lang,
                    'parent': self.parent,
                    'mime_type': self.mime_type,
                    'labels': {'user': self.username},
                }
            )
        except InvalidArgument as e:
            raise TranslationException(e.message)

        self._calculate_cost(chars=len(content))

        handle_translation(
            submission_uuid=self.submission_uuid,
            xpath=self.xpath,
            result=response.translations[0].translated_text,
        )
