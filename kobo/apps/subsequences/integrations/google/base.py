from __future__ import annotations

from abc import ABC, abstractmethod
from concurrent.futures import TimeoutError
from typing import Any

import constance
from google.cloud import storage
from google.api_core.operation import Operation
from googleapiclient import discovery
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache

from kobo.apps.trackers.utils import update_nlp_counter
from kpi.utils.log import logging
from .utils import google_credentials_from_constance_config
from ...models import SubmissionExtras
from ...constants import GOOGLE_CACHE_TIMEOUT, make_nlp_async_cache_key
from ...exceptions import SubsequenceTimeoutError


class GoogleService(ABC):
    """
    Base class for Google transcription/translation task
    Contains common functions for returning async responses using the Operations API
    """

    # These constants must be set by the inherited service class
    API_NAME = None
    API_VERSION = None
    API_RESOURCE = None

    def __init__(self, submission: SubmissionExtras):
        super().__init__()
        self.submission = submission
        self.asset = submission.asset
        self.user = submission.asset.owner
        self.credentials = google_credentials_from_constance_config()
        self.storage_client = storage.Client(credentials=self.credentials)
        self.bucket = self.storage_client.bucket(
            bucket_name=settings.GS_BUCKET_NAME
        )

    @abstractmethod
    def adapt_response(self, results: Any) -> str:
        pass

    @abstractmethod
    def begin_google_operation(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        content: Any,
    ) -> tuple[object, int]:
        pass

    @property
    @abstractmethod
    def counter_name(self):
        """
        Gets used by `update_nlp_counters()` - should begin with `google_`
        """
        return 'google_'

    def handle_google_operation(
        self, xpath: str, source_lang: str, target_lang: str, content: Any=None
    ) -> str:
        submission_id = self.submission.submission_uuid
        cache_key = make_nlp_async_cache_key(
            self.user.pk, submission_id, xpath, source_lang, target_lang
        )
        if operation_name := cache.get(cache_key):
            google_service = discovery.build(
                self.API_NAME, self.API_VERSION, credentials=self.credentials
            )
            resource_path = self.API_RESOURCE.split('.')
            for subresource in resource_path:
                google_service = getattr(google_service, subresource)()
            operation = google_service.get(name=operation_name).execute()
            if not (
                operation.get('done') or operation.get('state') == 'SUCCEEDED'
            ):
                raise SubsequenceTimeoutError

            cache.delete(cache_key)
            return self.adapt_response(operation)
        else:
            (response, amount) = self.begin_google_operation(
                xpath, source_lang, target_lang, content
            )
            if isinstance(response, Operation):
                cache.set(
                    cache_key, response.operation.name, GOOGLE_CACHE_TIMEOUT
                )
                self.update_counters(amount)
                try:
                    result = response.result(
                        timeout=constance.config.ASR_MT_GOOGLE_REQUEST_TIMEOUT
                    )
                except TimeoutError as err:
                    raise SubsequenceTimeoutError from err

                cache.delete(cache_key)
                return self.adapt_response(result)
            if isinstance(response, str):
                return response

    @abstractmethod
    def process_data(self, qpath: str, options: dict) -> dict:
        pass

    def qpath_to_xpath(self, qpath: str) -> str:
        xpath = None
        for row in self.asset.content['survey']:
            if '$qpath' in row and '$xpath' in row and row['$qpath'] == qpath:
                xpath = row['$xpath']
                break
        if xpath is None:
            raise KeyError(f'xpath for {qpath=} not found')
        return xpath

    def update_counters(self, amount) -> None:
        update_nlp_counter(
            self.counter_name,
            amount,
            self.asset.owner_id,
            self.asset.id,
        )
