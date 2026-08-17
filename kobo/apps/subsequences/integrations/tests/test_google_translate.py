from concurrent.futures import TimeoutError
from unittest.mock import MagicMock, patch

from constance.test import override_config
from django.core.cache import cache
from django.test import TestCase
from google.api_core.exceptions import GoogleAPIError, InvalidArgument

from kobo.apps.subsequences.integrations.google.google_translate import (
    GoogleTranslationService,
)
from kobo.apps.subsequences.integrations.google.rate_limit import (
    GoogleServiceRateLimitExceeded,
)
from kpi.models import Asset


class TestGoogleTranslate(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        cache.clear()
        self.asset = Asset.objects.get(pk=2)
        self.submission = {
            '_id': 13,
            'formhub/uuid': 'cdf8ecb909d04b51bac4c04f6517bd6e',
            'audio': 'longerrecording-13_0_56.mp3',
            'meta/instanceID': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            '_xform_id_string': self.asset.uid,
            '_uuid': '2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            'meta/rootUuid': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
        }

    def _build_service(self):
        mock_storage_client = MagicMock()
        mock_storage_client.bucket = MagicMock()

        with patch(
            'kobo.apps.subsequences.integrations.google.google_translate.google_credentials_from_constance_config',  # noqa
            return_value={},
        ):
            with patch(
                'kobo.apps.subsequences.integrations.google.base.google_credentials_from_constance_config',  # noqa
                return_value={},
            ):
                with patch(
                    'kobo.apps.subsequences.integrations.google.base.storage.Client',
                    return_value=mock_storage_client,
                ):
                    with patch(
                        'kobo.apps.subsequences.integrations.google.google_translate.translate.TranslationServiceClient',  # noqa
                        return_value=MagicMock(),
                    ):
                        return GoogleTranslationService(
                            self.submission,
                            self.asset,
                        )

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_sync_translation_returns_failed_for_invalid_argument(self):
        """
        Return a structured failure when Google rejects a synchronous
        translate_text request instead of letting the exception escape
        """
        service = self._build_service()
        service.translate_client.translate_text.side_effect = InvalidArgument(
            'Invalid language code'
        )

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                response = service.process_data(
                    'mock_xpath',
                    {
                        'language': 'fr',
                        '_dependency': {
                            'language': 'en',
                            'value': 'Hello',
                        },
                    },
                )

        assert response['status'] == 'failed'
        assert 'Translation failed with error' in response['error']

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_async_translation_returns_in_progress_timeout_and_saves_operation(self):
        """
        Start a large translation, return 'in_progress' on timeout so
        background polling can resume it, and keep the Google operation name
        in cache so the next poll resumes the same job instead of starting
        a duplicate one
        """
        service = self._build_service()
        operation = MagicMock()
        operation.operation.name = 'operations/translate-1'
        operation.result.side_effect = TimeoutError()

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch.object(
                    service,
                    'begin_google_operation',
                    return_value=(operation, 40000),
                ):
                    with patch.object(service, 'update_counters'):
                        response = service.process_data(
                            'mock_xpath',
                            {
                                'language': 'fr',
                                '_dependency': {
                                    'language': 'en',
                                    'value': 'Hello ' * 10000,
                                },
                            },
                        )

        cache_key = service._get_cache_key('mock_xpath', 'en-US', 'fr')
        assert response == {'status': 'in_progress'}
        assert cache.get(cache_key) == 'operations/translate-1'

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_async_translation_returns_in_progress_on_infra_error_and_saves_operation(
        self,
    ):
        """
        When Google's infrastructure is unreachable while waiting on a newly
        started batch job, return 'in_progress' instead of a hard failure and
        keep the operation reference so background polling can resume it
        """
        service = self._build_service()
        operation = MagicMock()
        operation.operation.name = 'operations/translate-1'
        operation.result.side_effect = GoogleAPIError('temporarily unavailable')

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch.object(
                    service,
                    'begin_google_operation',
                    return_value=(operation, 40000),
                ):
                    with patch.object(service, 'update_counters'):
                        response = service.process_data(
                            'mock_xpath',
                            {
                                'language': 'fr',
                                '_dependency': {
                                    'language': 'en',
                                    'value': 'Hello ' * 10000,
                                },
                            },
                        )

        cache_key = service._get_cache_key('mock_xpath', 'en-US', 'fr')
        assert response == {'status': 'in_progress'}
        assert cache.get(cache_key) == 'operations/translate-1'

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_async_translation_reuses_cached_operation_and_returns_complete(self):
        """
        Reuse an existing cached Google operation, read its finished batch
        output, return the translated text, and clear the operation cache
        """
        service = self._build_service()
        cache_key = service._get_cache_key('mock_xpath', 'en-US', 'fr')
        cache.set(cache_key, 'operations/translate-1', timeout=300)

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch.object(
                    service,
                    '_get_operation_payload',
                    return_value={'done': True},
                ):
                    with patch.object(
                        service,
                        '_read_batch_result',
                        return_value='Bonjour',
                    ):
                        response = service.process_data(
                            'mock_xpath',
                            {
                                'language': 'fr',
                                '_dependency': {
                                    'language': 'en',
                                    'value': 'Hello ' * 10000,
                                },
                            },
                        )

        assert response == {'status': 'complete', 'value': 'Bonjour'}
        assert cache.get(cache_key) is None

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_async_translation_reuses_cached_operation_and_returns_in_progress(self):
        """
        When a cached async translation is still running, return 'in_progress'
        and keep the cached operation so the next background poll resumes it
        """
        service = self._build_service()
        cache_key = service._get_cache_key('mock_xpath', 'en-US', 'fr')
        cache.set(cache_key, 'operations/translate-1', timeout=300)

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch.object(
                    service,
                    '_get_operation_payload',
                    return_value={'done': False},
                ):
                    response = service.process_data(
                        'mock_xpath',
                        {
                            'language': 'fr',
                            '_dependency': {
                                'language': 'en',
                                'value': 'Hello ' * 10000,
                            },
                        },
                    )

        assert response == {'status': 'in_progress'}
        assert cache.get(cache_key) == 'operations/translate-1'

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_async_translation_returns_in_progress_on_infra_error_while_polling(self):
        """
        When Google's infrastructure is unreachable while polling an existing
        batch job, return 'in_progress' instead of a hard failure and keep the
        cached operation so a later poll can resume it
        """
        service = self._build_service()
        cache_key = service._get_cache_key('mock_xpath', 'en-US', 'fr')
        cache.set(cache_key, 'operations/translate-1', timeout=300)

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch.object(
                    service,
                    '_get_operation_payload',
                    side_effect=GoogleAPIError('temporarily unavailable'),
                ):
                    response = service.process_data(
                        'mock_xpath',
                        {
                            'language': 'fr',
                            '_dependency': {
                                'language': 'en',
                                'value': 'Hello ' * 10000,
                            },
                        },
                    )

        assert response == {'status': 'in_progress'}
        assert cache.get(cache_key) == 'operations/translate-1'

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_operation_payload_can_be_dict(self):
        """
        Accept dict operation payloads from mocked or alternate Google clients
        without passing them through protobuf MessageToDict conversion
        """
        service = self._build_service()
        operations_client = (
            service.translate_client.transport.operations_client
        )
        operations_client.get_operation.return_value = {'done': True}

        assert service._get_operation_payload('operations/translate-1') == {
            'done': True
        }

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_bulk_action_uid_falls_back_to_cache_when_model_is_unavailable(self):
        """
        When bulk_action_uid is provided before SubsequenceBulkActionItem exists,
        fall back to cache-based operation tracking instead of failing
        """
        service = self._build_service()
        operation = MagicMock()
        operation.operation.name = 'operations/translate-2'
        operation.result.side_effect = TimeoutError()

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch(
                    'kobo.apps.subsequences.integrations.google.google_translate.apps.get_model',  # noqa
                    side_effect=LookupError(),
                ):
                    with patch.object(service, 'update_counters'):
                        with patch.object(
                            service,
                            'begin_google_operation',
                            return_value=(operation, 40000),
                        ):
                            response = service.process_data(
                                'mock_xpath',
                                {
                                    'language': 'fr',
                                    'bulk_action_uid': 'bulk-123',
                                    '_dependency': {
                                        'language': 'en',
                                        'value': 'Hello ' * 10000,
                                    },
                                },
                            )

        cache_key = service._get_cache_key('mock_xpath', 'en-US', 'fr')
        assert response == {'status': 'in_progress'}
        assert cache.get(cache_key) == 'operations/translate-2'

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_async_translation_raises_quota_error_when_start_quota_is_exhausted(self):
        """
        Verify that asynchronous bulk translations respect the global token bucket
        and abort before hitting the Google batch_translate API when limits are reached
        """
        service = self._build_service()

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch.object(
                    service,
                    'begin_google_operation',
                    side_effect=GoogleServiceRateLimitExceeded(
                        'translate_v3_batch_translate_text',
                        retry_after=1,
                    ),
                ):
                    with self.assertRaises(GoogleServiceRateLimitExceeded):
                        service.process_data(
                            'mock_xpath',
                            {
                                'language': 'fr',
                                '_dependency': {
                                    'language': 'en',
                                    'value': 'Hello ' * 10000,
                                },
                            },
                        )

        cache_key = service._get_cache_key('mock_xpath', 'en-US', 'fr')
        assert cache.get(cache_key) is None

    @override_config(
        ASR_MT_GOOGLE_PROJECT_ID='abc',
        ASR_MT_GOOGLE_REGION='global',
    )
    def test_sync_translation_raises_quota_error_when_quota_is_exhausted(self):
        """
        Verify that synchronous, real-time UI translations respect the global token
        bucket and abort before hitting the Google translate API when limits are reached
        """
        service = self._build_service()

        with patch.object(service, '_get_source_language_code', return_value='en-US'):
            with patch.object(service, '_get_target_language_code', return_value='fr'):
                with patch(
                    'kobo.apps.subsequences.integrations.google.google_translate.require_google_service_quota',  # noqa
                    side_effect=GoogleServiceRateLimitExceeded(
                        'translate_v3_translate_text',
                        retry_after=1,
                    ),
                ):
                    with self.assertRaises(GoogleServiceRateLimitExceeded):
                        service.process_data(
                            'mock_xpath',
                            {
                                'language': 'fr',
                                '_dependency': {
                                    'language': 'en',
                                    'value': 'Hello',
                                },
                            },
                        )

        service.translate_client.translate_text.assert_not_called()
