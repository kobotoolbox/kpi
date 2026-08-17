from __future__ import annotations

import hashlib
import posixpath
from concurrent.futures import TimeoutError
from typing import Any

import constance
from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from google.api_core import client_options
from google.api_core.exceptions import (
    GoogleAPIError,
    InvalidArgument,
    ResourceExhausted,
)
from google.cloud import translate_v3 as translate
from google.cloud.exceptions import GoogleCloudError
from google.protobuf.json_format import MessageToDict

from kobo.apps.languages.exceptions import LanguageNotSupported
from kobo.apps.languages.models.transcription import TranscriptionService
from kobo.apps.languages.models.translation import TranslationService
from kpi.utils.log import logging
from ...constants import GOOGLE_CACHE_TIMEOUT, GOOGLE_CODE
from ...exceptions import (
    GoogleQuotaExceededError,
    SubsequenceTimeoutError,
    TranslationResultNotFound,
)
from ..utils.google import google_credentials_from_constance_config
from .base import GoogleService
from .locations import get_translate_endpoint, get_translate_location
from .rate_limit import (
    GoogleServiceRateLimitExceeded,
    get_google_retry_after_seconds,
    require_google_service_quota,
)


class GoogleTranslationService(GoogleService):
    API_NAME = 'translate'
    API_VERSION = 'v3'
    API_RESOURCE = 'projects.locations.operations'
    MAX_SYNC_CHARS = 30720

    def __init__(self, submission: dict, asset: 'kpi.models.Asset', *args, **kwargs):
        """
        Translate submission content with Google Cloud Translation
        """
        super().__init__(submission, asset, *args, **kwargs)

        self.translate_client = translate.TranslationServiceClient(
            credentials=google_credentials_from_constance_config(),
            client_options=client_options.ClientOptions(
                api_endpoint=get_translate_endpoint()
            ),
        )
        translate_location = get_translate_location()
        self.translate_parent = (
            f'projects/{constance.config.ASR_MT_GOOGLE_PROJECT_ID}/'
            f'locations/{translate_location}'
        )
        self.translate_async_parent = self.translate_parent
        self.bucket_prefix = (
            constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX
        )

    def adapt_response(self, response: Any) -> str:
        """
        Extract translated text from a synchronous Translation API response
        """
        if isinstance(
            response, translate.types.translation_service.TranslateTextResponse
        ):
            return response.translations[0].translated_text
        if isinstance(response, str):
            return response
        return ''

    @property
    def counter_name(self):
        return 'google_mt_characters'

    def get_client_options(self):
        return client_options.ClientOptions(api_endpoint=get_translate_endpoint())

    def begin_google_operation(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        content: Any,
    ) -> tuple[object, int]:
        """
        Upload the source text and create a batch translation operation
        """
        source_path, output_prefix = self._get_batch_paths(
            xpath,
            source_lang,
            target_lang,
        )

        logging.info(
            'Starting async translation for '
            f'{self.submission_root_uuid=}, {xpath=}, {source_lang=}, '
            f'{target_lang=}'
        )
        # Check Redis bucket and halt locally if we are exceeding allowed requests
        require_google_service_quota('translate_v3_batch_translate_text')
        self._cleanup_batch_files(xpath, source_lang, target_lang)

        destination = self.bucket.blob(source_path)
        destination.upload_from_string(content, content_type='text/plain')

        response = self.translate_client.batch_translate_text(
            request={
                'parent': self.translate_async_parent,
                'source_language_code': source_lang,
                'target_language_codes': [target_lang],
                'input_configs': [
                    {
                        'gcs_source': {
                            'input_uri': (
                                f'gs://{settings.GS_BUCKET_NAME}/{source_path}'
                            )
                        },
                        'mime_type': 'text/plain',
                    }
                ],
                'output_config': {
                    'gcs_destination': {
                        'output_uri_prefix': (
                            f'gs://{settings.GS_BUCKET_NAME}/{output_prefix}/'
                        )
                    }
                },
                'labels': {
                    'username': self.asset.owner.username,
                    'submission': self.submission_root_uuid,
                    # Google labels must be lowercase
                    'xpath': xpath.lower(),
                },
            }
        )
        return response, len(content)

    def process_data(
        self,
        xpath: str,
        params: dict,
        bulk_action_uid: str | None = None,
    ) -> dict:
        """
        Translate one submission value using either sync or async Google APIs

        Returns:
        - `in_progress` while Google is still processing an async batch job
        - `complete` with a translated value when results are available
        - `failed` with a user-facing error for expected failures

        `bulk_action_uid` is an optional identifier for the SubsequenceBulkActionItem
        that is being processed. It is only relevant for async translations and if no
        bulk action item is available, async translations fall back to the existing
        cache-based operation tracking.

        When this returns `in_progress`, `BaseAutomaticNLPAction.run_external_process()`
        schedules the `poll_run_external_process` Celery task, which calls this method
        again in the background until the batch job finishes.
        """
        try:
            content = params['_dependency']['value']
            source_lang = params['_dependency']['language']
            target_lang = params['language']
        except KeyError:
            message = 'Error while setting up translation'
            logging.exception(message)
            return {'status': 'failed', 'error': message}

        try:
            source_language_code = self._get_source_language_code(source_lang)
            target_language_code = self._get_target_language_code(target_lang)
        except LanguageNotSupported as err:
            message = str(err) or 'Translation is not supported for this language.'
            return {'status': 'failed', 'error': message}

        if len(content) <= self.MAX_SYNC_CHARS:
            return self._translate_sync(
                content,
                source_language_code,
                target_language_code,
            )

        operation_name = self._get_operation_reference(
            xpath,
            source_language_code,
            target_language_code,
            bulk_action_uid,
        )

        if not operation_name:
            return self._start_async_translation(
                xpath,
                content,
                source_language_code,
                target_language_code,
                bulk_action_uid,
            )

        return self._poll_async_translation(
            xpath,
            source_language_code,
            target_language_code,
            bulk_action_uid,
            operation_name,
        )

    def _translate_sync(
        self,
        content: str,
        source_language_code: str,
        target_language_code: str,
    ) -> dict:
        """
        Translate small text immediately and return the final value
        """
        logging.info(
            'Starting sync translation for '
            f'{self.submission_root_uuid=}, {source_language_code=}, '
            f'{target_language_code=}'
        )
        try:
            # Check Redis bucket and halt locally if we are exceeding allowed requests
            require_google_service_quota('translate_v3_translate_text')
            response = self.translate_client.translate_text(
                request={
                    'contents': [content],
                    'source_language_code': source_language_code,
                    'target_language_code': target_language_code,
                    'parent': self.translate_parent,
                    'mime_type': 'text/plain',
                    'labels': {'username': self.asset.owner.username},
                }
            )
        except GoogleServiceRateLimitExceeded as err:
            logging.info(
                'Deferred Google sync translation because project quota is '
                'exhausted for '
                f'{self.submission_root_uuid=}, retry_after={err.retry_after}'
            )
            raise
        except ResourceExhausted as err:
            retry_after = get_google_retry_after_seconds(err)
            logging.warning(
                'Google sync translation quota was exhausted for '
                f'{self.submission_root_uuid=}, retry_after={retry_after}: {err}'
            )
            raise GoogleQuotaExceededError(retry_after=retry_after) from err
        except InvalidArgument as err:
            logging.exception('Error when processing translation')
            return {
                'status': 'failed',
                'error': f'Translation failed with error {str(err)}',
            }
        except (GoogleAPIError, GoogleCloudError) as err:
            logging.error(
                'Google infrastructure error while translating for '
                f'{self.submission_root_uuid=}: {err}'
            )
            return {
                'status': 'failed',
                'error': 'Translation failed due to a Google infrastructure '
                         f'error: {str(err)}',
            }

        try:
            self.update_counters(len(content))
        except Exception:
            logging.exception(
                'Failed to update translation usage counters for '
                f'{self.submission_root_uuid=}'
            )
        return {
            'status': 'complete',
            'value': self.adapt_response(response),
        }

    def _start_async_translation(
        self,
        xpath: str,
        content: str,
        source_language_code: str,
        target_language_code: str,
        bulk_action_uid: str | None,
    ) -> dict:
        """
        Create a new batch translation job and store its operation id
        """
        try:
            operation, amount = self.begin_google_operation(
                xpath,
                source_lang=source_language_code,
                target_lang=target_language_code,
                content=content,
            )
        except GoogleServiceRateLimitExceeded as err:
            logging.info(
                'Deferred Google async translation because project quota is '
                f'exhausted for {xpath=}, retry_after={err.retry_after}'
            )
            raise
        except ResourceExhausted as err:
            retry_after = get_google_retry_after_seconds(err)
            logging.warning(
                'Google async translation quota was exhausted for '
                f'{xpath=}, retry_after={retry_after}: {err}'
            )
            raise GoogleQuotaExceededError(retry_after=retry_after) from err
        except InvalidArgument as err:
            logging.exception('Error when starting translation')
            return {
                'status': 'failed',
                'error': f'Translation failed with error {str(err)}',
            }
        except (GoogleAPIError, GoogleCloudError, Exception) as err:
            return {
                'status': 'failed',
                'error': 'Translation failed due to an unexpected error while '
                         f'starting the translation for {xpath=}: {err}',
            }

        operation_name = operation.operation.name
        self._save_operation_reference(
            xpath,
            source_language_code,
            target_language_code,
            bulk_action_uid,
            operation_name,
        )
        self.update_counters(amount)

        try:
            operation.result(
                timeout=constance.config.ASR_MT_GOOGLE_REQUEST_TIMEOUT
            )
            value = self._read_batch_result(
                xpath,
                source_language_code,
                target_language_code,
            )
            self._clear_operation_reference(
                xpath,
                source_language_code,
                target_language_code,
                bulk_action_uid,
            )
            return {'status': 'complete', 'value': value}
        except TimeoutError:
            # Google is still working. The operation reference was already
            # saved above, so `poll_run_external_process` will pick up this
            # same batch job on its next attempt instead of starting a new one
            return {'status': 'in_progress'}
        except TranslationResultNotFound as err:
            logging.error(f'No translation output found for {xpath=}: {err}')
            self._clear_operation_reference(
                xpath,
                source_language_code,
                target_language_code,
                bulk_action_uid,
            )
            return {
                'status': 'failed',
                'error': f'Translation failed with error {str(err)}',
            }
        except ResourceExhausted as err:
            retry_after = get_google_retry_after_seconds(err)
            logging.warning(
                'Google async translation quota was exhausted while waiting for '
                f'{xpath=}, retry_after={retry_after}: {err}'
            )
            raise GoogleQuotaExceededError(retry_after=retry_after) from err
        except (GoogleAPIError, GoogleCloudError) as err:
            # Unable to reach Google to check on the operation, but the batch
            # job itself may still be running. Report 'in_progress' so
            # background polling retries instead of surfacing a hard failure
            logging.error(
                'Google infrastructure error while starting translation for '
                f'{xpath=}: {err}'
            )
            return {'status': 'in_progress'}

    def _poll_async_translation(
        self,
        xpath: str,
        source_language_code: str,
        target_language_code: str,
        bulk_action_uid: str | None,
        operation_name: str,
    ) -> dict:
        """
        Poll an existing Google batch translation operation
        """
        try:
            operation_payload = self._get_operation_payload(operation_name)
            if not operation_payload.get('done'):
                raise SubsequenceTimeoutError

            if operation_payload.get('error'):
                error = operation_payload['error'].get('message') or str(
                    operation_payload['error']
                )
                self._clear_operation_reference(
                    xpath,
                    source_language_code,
                    target_language_code,
                    bulk_action_uid,
                )
                return {
                    'status': 'failed',
                    'error': f'Translation failed with error {error}',
                }

            value = self._read_batch_result(
                xpath,
                source_language_code,
                target_language_code,
            )
        except SubsequenceTimeoutError:
            # The batch job is not done yet. Keep the operation reference so
            # `poll_run_external_process` resumes this same job on the next
            # background attempt
            logging.info(
                'Google batch translation still running for '
                f'{xpath=}, {self.submission_root_uuid=}'
            )
            return {'status': 'in_progress'}
        except TranslationResultNotFound as err:
            logging.error(f'No translation output found for {xpath=}: {err}')
            self._clear_operation_reference(
                xpath,
                source_language_code,
                target_language_code,
                bulk_action_uid,
            )
            return {
                'status': 'failed',
                'error': f'Translation failed with error {str(err)}',
            }
        except ResourceExhausted as err:
            retry_after = get_google_retry_after_seconds(err)
            logging.warning(
                'Google async translation quota was exhausted while polling '
                f'{xpath=}, retry_after={retry_after}: {err}'
            )
            raise GoogleQuotaExceededError(retry_after=retry_after) from err
        except (GoogleAPIError, GoogleCloudError) as err:
            # Keep the operation reference so a later polling attempt can
            # resume instead of recreating the Google job
            logging.error(
                'Google infrastructure error while polling translation for '
                f'{xpath=}: {err}'
            )
            return {'status': 'in_progress'}

        self._clear_operation_reference(
            xpath,
            source_language_code,
            target_language_code,
            bulk_action_uid,
        )
        return {'status': 'complete', 'value': value}

    def _get_source_language_code(self, requested_language: str) -> str:
        """
        Resolve the Google source language code from the transcription record
        """
        try:
            transcription_lang_service = TranscriptionService.objects.get(
                code=GOOGLE_CODE
            )
        except TranscriptionService.DoesNotExist:
            raise LanguageNotSupported(
                'Google transcription service is not configured.'
            )
        return transcription_lang_service.get_language_code(requested_language)

    def _get_target_language_code(self, requested_language: str) -> str:
        """
        Resolve the Google target language code from the translation record
        """
        try:
            translation_lang_service = TranslationService.objects.get(
                code=GOOGLE_CODE
            )
        except TranslationService.DoesNotExist:
            raise LanguageNotSupported(
                'Google translation service is not configured.'
            )
        return translation_lang_service.get_language_code(requested_language)

    def _get_batch_paths(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
    ) -> tuple[str, str]:
        """
        Build deterministic GCS paths for the source file and batch output
        """
        base_hash = hashlib.md5(
            ':'.join(
                [
                    str(self.asset.owner_id),
                    self.submission_root_uuid,
                    xpath,
                    source_lang.lower(),
                    target_lang.lower(),
                ]
            ).encode(),
            usedforsecurity=False,
        ).hexdigest()[:16]

        base_dir = posixpath.join(
            self.bucket_prefix,
            'translate-v3',
            base_hash,
        )
        return (
            posixpath.join(base_dir, 'source.txt'),
            posixpath.join(base_dir, 'output'),
        )

    def _cleanup_batch_files(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
    ) -> None:
        """
        Remove any stale input/output files before starting a new batch job
        """
        source_path, output_prefix = self._get_batch_paths(
            xpath,
            source_lang,
            target_lang,
        )
        for prefix in (source_path, output_prefix):
            for blob in self.bucket.list_blobs(prefix=prefix):
                blob.delete()

    def _read_batch_result(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
    ) -> str:
        """
        Read translated output files from GCS and delete them after success
        """
        _, output_prefix = self._get_batch_paths(xpath, source_lang, target_lang)
        text_parts = []
        blobs_to_delete = []
        blobs = sorted(
            self.bucket.list_blobs(prefix=output_prefix),
            key=lambda blob: blob.name,
        )
        for blob in blobs:
            if not blob.name.endswith('.txt'):
                blobs_to_delete.append(blob)
                continue
            text = blob.download_as_text().strip()
            if text:
                text_parts.append(text)
            blobs_to_delete.append(blob)
        if not text_parts:
            raise TranslationResultNotFound(
                'No translation output files were found in Google Cloud Storage.'
            )

        for blob in blobs_to_delete:
            blob.delete()
        return '\n'.join(text_parts).strip()

    def _get_operation_payload(self, operation_name: str) -> dict:
        """
        Poll the Google long-running operation backing the batch request
        """
        operation = self.translate_client.transport.operations_client.get_operation(
            operation_name
        )
        if isinstance(operation, dict):
            return operation

        return MessageToDict(
            operation._pb if hasattr(operation, '_pb') else operation,
            preserving_proto_field_name=True,
        )

    def _get_bulk_action_item(self, bulk_action_uid: str | None):
        """
        Retrieve the `SubsequenceBulkActionItem` for this submission

        Returns the matching database record using the parent bulk action UID
        and the submission root UUID. This allows bulk translations to track
        their Google operations in the database rather than falling back to cache.
        """
        if not bulk_action_uid:
            return None

        try:
            SubsequenceBulkActionItem = apps.get_model(  # noqa: N806
                'subsequences',
                'SubsequenceBulkActionItem',
            )
        except LookupError:
            logging.info(
                'bulk_action_uid was provided but the SubsequenceBulkActionItem '
                'model could not be loaded, using cache fallback'
            )
            return None

        try:
            return SubsequenceBulkActionItem.objects.get(
                parent__uid=bulk_action_uid,
                submission_root_uuid=self.submission_root_uuid,
            )
        except SubsequenceBulkActionItem.DoesNotExist:
            logging.warning(
                'No SubsequenceBulkActionItem found for '
                f'{bulk_action_uid=}, {self.submission_root_uuid=}'
            )
            return None

    def _get_operation_reference(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        bulk_action_uid: str | None,
    ) -> str | None:
        """
        Fetch the persisted Google operation id from bulk storage or cache
        """
        from ...models import PENDING_OPERATION_MARKER

        bulk_action_item = self._get_bulk_action_item(bulk_action_uid)
        if (
            bulk_action_item
            and bulk_action_item.service_id
            and bulk_action_item.service_id != PENDING_OPERATION_MARKER
        ):
            return bulk_action_item.service_id

        cache_key = self._get_cache_key(xpath, source_lang, target_lang)
        return cache.get(cache_key)

    def _save_operation_reference(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        bulk_action_uid: str | None,
        operation_name: str,
    ) -> None:
        """
        Persist the operation id so future polls can resume the same job
        """
        bulk_action_item = self._get_bulk_action_item(bulk_action_uid)
        if bulk_action_item:
            bulk_action_item.service_id = operation_name
            bulk_action_item.save(update_fields=['service_id', 'date_modified'])
            return

        cache_key = self._get_cache_key(xpath, source_lang, target_lang)
        cache.set(cache_key, operation_name, timeout=GOOGLE_CACHE_TIMEOUT)

    def _clear_operation_reference(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        bulk_action_uid: str | None,
    ) -> None:
        """
        Remove the stored operation id after completion or terminal failure
        """
        bulk_action_item = self._get_bulk_action_item(bulk_action_uid)
        if bulk_action_item:
            bulk_action_item.service_id = ''
            bulk_action_item.save(update_fields=['service_id', 'date_modified'])
            return

        cache_key = self._get_cache_key(xpath, source_lang, target_lang)
        cache.delete(cache_key)
