import uuid
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass
from os import environ
from typing import (
    Dict,
    List,
    Optional,
    TypeVar,
    Union,
)

from google.api_core.exceptions import InvalidArgument
from google.auth.exceptions import DefaultCredentialsError
from google.cloud import translate_v3 as translate, storage


BUCKET_NAME = 'kobo-translations-test-qwerty12345'
EXTENSION = '.txt'
LOCATION = 'us-central1'
MAX_SYNC_CHARS = 30720
PROJECT_ID = 'kobo-nlp-asr-mt'
SOURCE_BASENAME = 'source'
TIMEOUT = 360


class TranslationException(Exception):
    pass


class TranslationEngineBase(ABC):
    @abstractmethod
    def get_languages(
        self, labels: bool = False, display_language: str = 'en'
    ) -> Union[Dict, List]:
        pass

    @abstractmethod
    def translate(
        self, content: str, target_lang: str, source_lang: Optional[str] = None
    ) -> str:
        pass


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

    def translate(self, content: str, *args: List, **kwargs: Dict) -> str:
        if len(content) < MAX_SYNC_CHARS:
            return self._translate_sync(content, *args, **kwargs)
        return self._translate_async(content, *args, **kwargs)

    def _cleanup(self, username: str, _uuid: str) -> None:
        for blob in self.bucket.list_blobs(prefix=f'{username}/{_uuid}'):
            try:
                blob.delete()
            except Exception as e:
                raise TranslationException(e)

    def _get_content(self, path: str) -> str:
        return self.bucket.get_blob(path).download_as_text()

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
        source_path = f'{username}/{_uuid}/{SOURCE_BASENAME}{EXTENSION}'
        output_path = f'{username}/{_uuid}/{target_lang}/'

        storage_response = self._store_content(content, source_path)

        if not storage_response:
            raise TranslationException('Unable to store content in GCP')

        input_uri = f'{self.uri_base}/{source_path}'
        output_uri = f'{self.uri_base}/{output_path}'
        output_filename = self._get_output_filename(output_path)

        input_configs_element = {
            'gcs_source': {'input_uri': input_uri},
            'mime_type': self.mime_type,
        }
        output_config = {'gcs_destination': {'output_uri_prefix': output_uri}}

        operation = self.client.batch_translate_text(
            request={
                'parent': self.parent_async,
                'source_language_code': source_lang,
                'target_language_codes': [target_lang],
                'input_configs': [input_configs_element],
                'output_config': output_config,
                'labels': {'user': username},
            }
        )
        response = operation.result(TIMEOUT)
        content = self._get_content(output_filename)

        # Remove created files from GCP
        self._cleanup(username, _uuid)

        return content

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

        return response.translations[0].translated_text


TranslationEngine = TypeVar('TranslationEngine')


@dataclass
class Engine:
    engine: Optional[TranslationEngine]
    label: str
    description: str
    enabled: bool


class Translate:
    SERVICES = {
        'google': Engine(
            engine=GoogleTranslationEngine,
            label='Google Transcription Services',
            description='Translation services provided by Google.',
            enabled=True,
        ),
        'aws': Engine(
            engine=None,
            label='AWS Transcription Services',
            description='Translation services provided by Amazon Web Services.',
            enabled=False,
        ),
        'twb': Engine(
            engine=None,
            label='Translators Without Borders Transcription Services',
            description='Translation services provided by Translators Without Borders.',
            enabled=False,
        ),
        'ibm': Engine(
            engine=None,
            label='IBM Transcription Services',
            description='Translation services provided by IBM.',
            enabled=False,
        ),
    }

    @classmethod
    def get_engine(cls, service_code: str) -> TranslationEngine:
        service = None
        try:
            service = cls.SERVICES[service_code]
        except KeyError:
            raise TranslationException(
                f'Service "{service_code}" is not supported.'
            )
        if not service.enabled:
            raise TranslationException(
                f'Service "{service_code}" is not enabled.'
            )
        return service.engine

    @classmethod
    def get_services(
        cls, labels: bool = False, description: bool = False
    ) -> Union[Dict, List]:
        if labels:
            return {
                service: details.label
                for service, details in cls.SERVICES.items()
                if details.enabled
            }
        if description:
            return {
                service: details.description
                for service, details in cls.SERVICES.items()
                if details.enabled
            }
        return [
            service
            for service, details in cls.SERVICES.items()
            if details.enabled
        ]


def run(*args):
    if len(args) < 3:
        print('args: content, source_lang, target_lang')
        sys.exit()
    engine = Translate.get_engine('google')()
    options = {
        'content': args[0],
        'username': 'josh',
        '_uuid': uuid.uuid4(),
        'source_lang': args[1],
        'target_lang': args[2],
    }
    print(engine.translate(**options))
