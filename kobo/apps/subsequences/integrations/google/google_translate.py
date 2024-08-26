from __future__ import annotations

import posixpath
from datetime import date
from hashlib import md5
from typing import Union, Any

import constance
from django.conf import settings
from django.utils import timezone
from google.api_core.exceptions import InvalidArgument
from google.cloud import translate_v3 as translate, storage

from kobo.apps.languages.models.translation import TranslationService
from kpi.utils.log import logging
from .base import GoogleService
from .utils import google_credentials_from_constance_config
from ...constants import GOOGLETX, GOOGLE_CODE
from ...exceptions import (
    SubsequenceTimeoutError,
    TranslationResultsNotFound,
    TranslationAsyncResultAvailable,
)

MAX_SYNC_CHARS = 30720


def _hashed_strings(self, *strings):
    return md5(''.join(strings).encode()).hexdigest()[0:10]


class GoogleTranslationService(GoogleService):
    API_NAME = 'translate'
    API_VERSION = 'v3'
    API_RESOURCE = 'projects.locations.operations'

    def __init__(self, *args):
        """
        This service takes a submission object as a GoogleService inheriting
        class. It uses google cloud translation v3 API.
        """
        super().__init__(*args)

        self.translate_client = translate.TranslationServiceClient(
            credentials=google_credentials_from_constance_config()
        )
        self.translate_parent = (
            f'projects/{constance.config.ASR_MT_GOOGLE_PROJECT_ID}'
        )
        # "The global location is not supported for batch translation." See:
        # https://googleapis.dev/python/translation/2.0.0/gapic/v3/api.html
        # https://www.googlecloudcommunity.com/gc/AI-ML/location-variable-setting-for-the-Google-Cloud-Translation-API/m-p/543622/highlight/true#M1652
        self.translate_async_parent = (
            f'projects/{constance.config.ASR_MT_GOOGLE_PROJECT_ID}/'
            f'locations/{constance.config.ASR_MT_GOOGLE_TRANSLATION_LOCATION}'
        )
        self.bucket_prefix = (
            constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX
        )
        self.date_string = date.today().isoformat()

    def adapt_response(self, response: Union[dict, list]) -> str:
        """
        Extract the translation string from the response data
        """
        if isinstance(
            response, translate.types.translation_service.TranslateTextResponse
        ):
            return response.translations[0].translated_text
        elif isinstance(response, str):
            return response
        elif isinstance(response, dict) and response.get('done'):
            raise TranslationAsyncResultAvailable()

        return ''

    def begin_google_operation(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        content: Any,
    ) -> tuple[object, int]:
        """
        Set up translation operation
        """
        source_path, output_path = self.get_unique_paths(
            xpath, source_lang, target_lang
        )

        # check if directory is not empty
        if stored_result := self.get_stored_result(target_lang, output_path):
            logging.info(f'Found stored results in {output_path=}')
            return (stored_result, len(content))

        logging.info(
            f'Starting async translation for {self.submission.submission_uuid=} {xpath=}'
        )
        dest = self.bucket.blob(source_path)
        dest.upload_from_string(content)

        req_params = {
            'parent': self.translate_async_parent,
            'source_language_code': source_lang,
            'target_language_codes': [target_lang],
            'input_configs': [
                {
                    'gcs_source': {
                        'input_uri': f'gs://{settings.GS_BUCKET_NAME}/{source_path}'
                    },
                    'mime_type': 'text/plain',
                }
            ],
            'output_config': {
                'gcs_destination': {
                    'output_uri_prefix': (
                        f'gs://{settings.GS_BUCKET_NAME}/{output_path}'
                    )
                }
            },
            'labels': {
                'username': self.user.username,
                'submission': self.submission.submission_uuid,
                # this needs to be lowercased to comply with google's API
                'xpath': xpath.lower(),
            },
        }

        response = self.translate_client.batch_translate_text(
            request=req_params
        )
        return (response, len(content))

    @property
    def counter_name(self):
        return 'google_mt_characters'

    def get_stored_result(self, target_lang, output_dir: str) -> str:
        """
        Reads the translation file from the bucket storage and deletes all
        the files in the output path.
        """
        text = ''
        for blob in self.bucket.list_blobs(prefix=output_dir):
            if f'_{target_lang}_translations' in blob.name:
                text = blob.download_as_text()
                blob.delete()
            else:
                blob.delete()

        return text

    def get_unique_paths(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
    ) -> tuple[str, str]:
        """
        Returns source and output paths based on the parameters used and the
        current date.
        """
        submission_uuid = self.submission.submission_uuid
        _hash = _hashed_strings(
            self.submission.submission_uuid, xpath, self.user.username
        )
        _uniq_dir = f'{self.date_string}/{_hash}/{source_lang}/{target_lang}/'
        source_path = posixpath.join(
            self.bucket_prefix, _uniq_dir, 'source.txt'
        )
        output_path = posixpath.join(
            self.bucket_prefix, _uniq_dir, 'completed/'
        )
        return source_path, output_path

    def process_data(self, qpath: str, vals: dict) -> dict:
        """
        Translates the value for a given qpath and it's json values.
        """
        autoparams = vals[GOOGLETX]
        xpath = self.qpath_to_xpath(qpath)
        try:
            content = vals['transcript']['value']
            source_lang = vals['transcript']['languageCode']
            target_lang = autoparams.get('languageCode')
        except KeyError:
            logging.exception('Error while setting up translation')
            return {'status': 'error'}

        lang_service = TranslationService.objects.get(code=GOOGLE_CODE)
        try:
            value = self.translate_content(
                xpath,
                lang_service.get_language_code(source_lang),
                lang_service.get_language_code(target_lang),
                content,
            )
        except SubsequenceTimeoutError:
            return {
                'status': 'in_progress',
                'source': source_lang,
                'languageCode': target_lang,
                'value': None,
            }
        except (TranslationResultsNotFound, InvalidArgument) as e:
            logging.exception('Error when processing translation')
            return {
                'status': 'error',
                'value': None,
                'responseJSON': {
                    'error': f'Translation failed with error {e}'
                },
            }
        except TranslationAsyncResultAvailable:
            _, output_path = self.get_unique_paths(
                xpath, source_lang, target_lang
            )
            logging.info(
                f'Fetching stored results for {self.submission.submission_uuid=} {xpath=}, {output_path=}'
            )
            value = self.get_stored_result(target_lang, output_path)

        return {
            'status': 'complete',
            'source': source_lang,
            'languageCode': target_lang,
            'value': value,
        }

    def translate_content(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        content: str,
    ) -> str:
        """
        Translates an input content string
        """
        content_size = len(content)
        if content_size <= MAX_SYNC_CHARS:
            logging.info(
                f'Starting sync translation for {self.submission.submission_uuid=} {xpath=}'
            )
            response = self.translate_client.translate_text(
                request={
                    'contents': [content],
                    'source_language_code': source_lang,
                    'target_language_code': target_lang,
                    'parent': self.translate_parent,
                    'mime_type': 'text/plain',
                    'labels': {'username': self.user.username},
                }
            )
            self.update_counters(content_size)
            return self.adapt_response(response)
        else:
            response = self.handle_google_operation(
                xpath, source_lang, target_lang, content
            )
            return response
