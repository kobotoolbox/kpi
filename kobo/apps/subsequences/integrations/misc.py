from abc import ABC, abstractmethod
from typing import (
    Dict,
    List,
    Optional,
    TypeVar,
    Union,
)

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


