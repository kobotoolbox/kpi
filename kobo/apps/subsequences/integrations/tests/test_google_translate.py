from unittest.mock import MagicMock, patch

from constance.test import override_config
from ddt import data, ddt
from django.test import TestCase

from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError
from kobo.apps.subsequences.integrations.google.google_translate import (
    GoogleTranslationService,
)
from kpi.models import Asset


@ddt
class TestGoogleTranslate(TestCase):

    fixtures = ['test_data']

    @override_config(ASR_MT_GOOGLE_PROJECT_ID='abc')
    @data(True, False)
    def test_return_error_if_timeout(self, force_async):
        asset = Asset.objects.get(pk=2)

        mock_storage_client = MagicMock()
        mock_storage_client.bucket = MagicMock()

        submission = {
            '_id': 13,
            'formhub/uuid': 'cdf8ecb909d04b51bac4c04f6517bd6e',
            'audio': 'longerrecording-13_0_56.mp3',
            'meta/instanceID': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            '_xform_id_string': asset.uid,
            '_uuid': '2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            'meta/rootUuid': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
        }

        with patch(
            'kobo.apps.subsequences.integrations.google.base.google_credentials_from_constance_config',  # noqa: E501
            return_value={},
        ), patch(
            'kobo.apps.subsequences.integrations.google.base.storage.Client',
            return_value=mock_storage_client,
        ), patch(
            'kobo.apps.subsequences.integrations.google.google_translate.translate.TranslationServiceClient',  # noqa: E501
            return_value=MagicMock(),
        ):
            service = GoogleTranslationService(submission, asset)
            with patch.object(
                service,
                'translate_content',
                MagicMock(side_effect=SubsequenceTimeoutError()),
            ):
                text_to_translate = 'Hello'
                if force_async:
                    text_to_translate = text_to_translate * service.MAX_SYNC_CHARS
                res = service.process_data(
                    'mock_xpath',
                    {
                        'language': 'fr',
                        '_dependency': {
                            'language': 'en',
                            'value': text_to_translate,
                        },
                    },
                )

        assert res['status'] == 'failed'
        assert 'Timed out' in res['error']

    @override_config(ASR_MT_GOOGLE_PROJECT_ID='xyz')
    @override_config(ASR_MT_GOOGLE_REGION='europe-west1')
    def test_translation_service_uses_regional_parent(self):
        asset = Asset.objects.get(pk=2)
        submission = {'_id': 1, 'meta/rootUuid': 'uuid:123'}
        with patch(
            'kobo.apps.subsequences.integrations.google.base.google_credentials_from_constance_config',  # noqa: E501
            return_value={},
        ), patch(
            'kobo.apps.subsequences.integrations.google.base.storage.Client'
        ), patch(
            'kobo.apps.subsequences.integrations.google.google_translate.translate.TranslationServiceClient'  # noqa: E501
        ) as mock_translate_client:
            service = GoogleTranslationService(submission, asset)
            assert service.translate_parent == 'projects/xyz/locations/europe-west1'
            assert (
                service.translate_async_parent == 'projects/xyz/locations/europe-west1'
            )  # noqa: E501
            kwargs = mock_translate_client.call_args[1]
            assert (
                kwargs['client_options'].api_endpoint == 'translate-eu.googleapis.com'
            )  # noqa: E501

    @override_config(ASR_MT_GOOGLE_PROJECT_ID='xyz')
    @override_config(ASR_MT_GOOGLE_REGION='global')
    def test_translation_service_uses_global_parent_for_sync(self):
        asset = Asset.objects.get(pk=2)
        submission = {'_id': 1, 'meta/rootUuid': 'uuid:123'}
        with patch(
            'kobo.apps.subsequences.integrations.google.base.google_credentials_from_constance_config',  # noqa: E501
            return_value={},
        ), patch(
            'kobo.apps.subsequences.integrations.google.base.storage.Client'
        ), patch(
            'kobo.apps.subsequences.integrations.google.google_translate.translate.TranslationServiceClient'  # noqa: E501
        ) as mock_translate_client:
            service = GoogleTranslationService(submission, asset)
            assert service.translate_parent == 'projects/xyz'
            assert (
                service.translate_async_parent == 'projects/xyz/locations/us-central1'
            )  # noqa: E501
            kwargs = mock_translate_client.call_args[1]
            assert (
                kwargs['client_options'].api_endpoint == 'translate.googleapis.com'
            )  # noqa: E501
