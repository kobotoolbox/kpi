import json
from abc import ABC, abstractmethod
from os import environ
from dataclasses import dataclass
from typing import List, Dict, Optional, Union, TypeVar

from google.api_core.exceptions import InvalidArgument
from google.auth.exceptions import DefaultCredentialsError
from google.cloud import translate_v3 as translate


PROJECT_ID = 'kobo-nlp-asr-mt'


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
        self, content: str, target_lang: str, source_lang: Optional[str] = None
    ) -> str:
        try:
            response = self.client.translate_text(
                contents=[content],
                source_language_code=source_lang,
                target_language_code=target_lang,
                parent=self.parent,
                mime_type=self.mime_type,
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
    engine = Translate.get_engine('google')()
    print(engine.translate('Hello world', target_lang='eo'))
