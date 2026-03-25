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
                        service = GoogleTranslationService(submission, asset)
                        with patch.object(
                            service,
                            'translate_content',
                            MagicMock(side_effect=SubsequenceTimeoutError()),
                        ):
                            text_to_translate = 'Hello'
                            if force_async:
                                text_to_translate = (
                                    text_to_translate * service.MAX_SYNC_CHARS
                                )
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
