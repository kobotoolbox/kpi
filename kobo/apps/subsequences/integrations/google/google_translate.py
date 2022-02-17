from typing import (
    Dict,
    List,
    Optional,
    Union,
)

from google.api_core.exceptions import InvalidArgument
from google.auth.exceptions import DefaultCredentialsError
from google.cloud import translate_v3 as translate, storage

from ..misc import TranslationEngineBase, TranslationException

from kobo.apps.subsequences.tasks.handle_translation import handle_translation


BUCKET_NAME = 'kobo-translations-test-qwerty12345'
EXTENSION = '.txt'
LOCATION = 'us-central1'
MAX_SYNC_CHARS = 30720
PROJECT_ID = 'kobo-nlp-asr-mt'
SOURCE_BASENAME = 'source'
TIMEOUT = 360
COST = 20 / 1000000  # https://cloud.google.com/translate/pricing


class GoogleTranslationEngine(TranslationEngineBase):
    def __init__(self):
        self.parent = f'projects/{PROJECT_ID}'
        self.mime_type = 'text/plain'
        try:
            self.client = translate.TranslationServiceClient()
        except DefaultCredentialsError as e:
            raise TranslationException(e)

        self.uri_base = f'gs://{BUCKET_NAME}'
        self.parent_async = f'projects/{PROJECT_ID}/locations/{LOCATION}'
        self.storage_client = storage.Client()
        self.bucket = self.storage_client.bucket(bucket_name=BUCKET_NAME)
        self.state = 'BARDO'
        self.cost = 0

    def cancel(self) -> bool:
        self.operation.cancel()
        self._cleanup()
        self.state = 'CANCELLED'
        self.cost= 0
        return True

    def get_languages(
        self, labels: bool = False, display_language: str = 'en'
    ) -> Union[Dict, List]:
        response = self.client.get_supported_languages(
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
        force_async: bool = False,
        *args: List,
        **kwargs: Dict
    ) -> str:
        if len(content) < MAX_SYNC_CHARS and not force_async:
            return self._translate_sync(content, *args, **kwargs)
        return self._translate_async(content, *args, **kwargs)

    def _cleanup(self) -> None:
        for blob in self.bucket.list_blobs(
            prefix=f'{self.username}/{self._uuid}'
        ):
            try:
                blob.delete()
            except Exception as e:
                raise TranslationException(e)

    def _calculate_cost(self, chars: int) -> None:
        self.cost = COST * chars

    def _get_content(self) -> str:
        return self.bucket.get_blob(self.output_filename).download_as_text()

    def callback(self, future: 'google.api_core.operation_async.AsyncOperation') -> None:
        # Do something with the result
        self.result = future.result()
        self.state = 'SUCCEEDED'
        result = self._get_content()

        # xpath = 'path/to/question'
        # submission_uuid = 'submisisonuuid'
        # handle_translation(submission_uuid, xpath, result)

        self._cleanup()

    def _get_output_filename(self, output_path: str) -> str:
        username, _uuid, target_lang, _ = output_path.split('/')
        return output_path + '_'.join(
            [
                BUCKET_NAME,
                username,
                _uuid,
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
        username: str,
        _uuid: str,
        source_lang: str,
        target_lang: str,
    ) -> str:
        self.username = username
        self._uuid = _uuid

        source_path = f'{username}/{_uuid}/{SOURCE_BASENAME}{EXTENSION}'
        output_path = f'{username}/{_uuid}/{target_lang}/'

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
        self.operation = self.client.batch_translate_text(
            request={
                'parent': self.parent_async,
                'source_language_code': source_lang,
                'target_language_codes': [target_lang],
                'input_configs': [input_configs_element],
                'output_config': output_config,
                'labels': {'user': username},
            }
        )
        self.operation.add_done_callback(self.callback)
        self.operation.set_exception(TranslationException)
        self.state = 'RUNNING'

    def _translate_sync(
        self,
        content: str,
        username: str,
        target_lang: str,
        source_lang: Optional[str] = None,
        *args: List,
        **kwargs: Dict,
    ) -> str:
        try:
            response = self.client.translate_text(
                request={
                    'contents': [content],
                    'source_language_code': source_lang,
                    'target_language_code': target_lang,
                    'parent': self.parent,
                    'mime_type': self.mime_type,
                    'labels': {'user': username},
                }
            )
        except InvalidArgument as e:
            raise TranslationException(e.message)

        self._calculate_cost(chars=len(content))

        return response.translations[0].translated_text
