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


class GoogleTranslationBase:
    def __init__(self):
        self.translate_client = translate.TranslationServiceClient()
        self.storage_client = storage.Client()
        self.bucket = self.storage_client.bucket(bucket_name=BUCKET_NAME)


class GoogleTranslationEngineAsyncResult(GoogleTranslationBase):
    def __init__(
        self,
        username: str,
        submission_uuid: str,
        operation_name: str,
        output_filename: str,
        *args,
        **kwargs
    ):
        super().__init__()
        self.operation_client = operations_v1.OperationsClient(
            channel=self.translate_client.transport.grpc_channel
        )
        self.username = username
        self.submission_uuid = submission_uuid
        self.output_filename = output_filename
        self.operation_name = operation_name
        self.state = 'BARDO'

    def _wait_for_result(self):
        duration = 0
        wait = 10
        done = False
        while not done and duration < TIMEOUT:
            done = self.operation_client.get_operation(
                name=self.operation_name
            ).done
            time.sleep(wait)
            duration += wait
        self.state = 'SUCCEEDED'
        return True

    def _cleanup(self) -> None:
        for blob in self.bucket.list_blobs(
            prefix=f'{self.username}/{self.submission_uuid}'
        ):
            blob.delete()
        return True

    def _get_content(self):
        return self.bucket.get_blob(self.output_filename).download_as_text()

    def result(self):
        self._wait_for_result()
        _result = self._get_content()
        self._cleanup()
        return _result
