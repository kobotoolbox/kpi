import time
from abc import ABC, abstractmethod
from typing import (
    Dict,
    List,
    Optional,
    TypeVar,
    Union,
)

from google.api_core import operations_v1
from google.cloud import translate_v3 as translate, storage


BUCKET_NAME = 'kobo-translations-test-qwerty12345'
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
