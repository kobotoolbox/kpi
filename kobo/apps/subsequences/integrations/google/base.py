from __future__ import annotations

from abc import ABC, abstractmethod
from concurrent.futures import TimeoutError
from typing import Any

import constance
from django.conf import settings
from django.core.cache import cache
from google.api_core.operation import Operation
from google.cloud import storage
from googleapiclient import discovery

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kobo.apps.trackers.utils import update_nlp_counter
from kpi.utils.log import logging
from ...constants import (
    GOOGLE_CACHE_TIMEOUT,
    SUBMISSION_UUID_FIELD,
    SUBSEQUENCES_ASYNC_CACHE_KEY,
)
from ...exceptions import GoogleCloudStorageBucketNotFound, SubsequenceTimeoutError
from ..utils.google import google_credentials_from_constance_config


class GoogleService(ABC):
    """
    Base class for Google transcription/translation task
    Contains common functions for returning async responses using the Operations API
    """

    # These constants must be set by the inherited service class
    API_NAME = None
    API_VERSION = None
    API_RESOURCE = None

    def __init__(self, submission: dict, asset: 'kpi.models.Asset', *args, **kwargs):
        super().__init__()
        self.submission = submission
        self.submission_root_uuid = remove_uuid_prefix(
            self.submission[SUBMISSION_UUID_FIELD]
        )
        self.asset = asset  # Need to retrieve the attachment content
        self.credentials = google_credentials_from_constance_config()
        self.storage_client = storage.Client(credentials=self.credentials)
        self._validate_settings()

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

        # If cache_key is still present, the job is not complete (or it crashed).
        # Fetch the latest update from Google API, but do not resend the same operation.
        cache_key = self._get_cache_key(xpath, source_lang, target_lang)
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
            response, amount = self.begin_google_operation(
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

        return

    @abstractmethod
    def process_data(self, xpath: str, options: dict) -> dict:
        pass

    def update_counters(self, amount) -> None:
        update_nlp_counter(
            self.counter_name,
            amount,
            self.asset.owner_id,
            self.asset.id,
        )

    def _get_cache_key(
        self, xpath: str, source_lang: str, target_lang: str | None
    ) -> str:
        args = [
            self.asset.owner_id,
            self.submission_root_uuid,
            xpath,
            source_lang.lower(),
        ]
        if target_lang is None:
            args.insert(0, 'transcribe')
        else:
            args.insert(0, 'translate')
            args.append(target_lang.lower())

        return '::'.join(map(str, [SUBSEQUENCES_ASYNC_CACHE_KEY, *args]))

    def _validate_settings(self) -> dict:
        if not getattr(settings, 'GS_BUCKET_NAME', None):
            logging.warning(
                'GS_BUCKET_NAME is None, NLP processing will fail '
                'when storing files in google cloud.'
            )
            raise GoogleCloudStorageBucketNotFound
        else:
            self.bucket = self.storage_client.bucket(
                bucket_name=settings.GS_BUCKET_NAME
            )
