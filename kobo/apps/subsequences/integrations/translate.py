from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import (
    Dict,
    List,
    Optional,
    TypeVar,
    Union,
)

from .google_translate import GoogleTranslationEngine


TranslationEngine = TypeVar('TranslationEngine')


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
