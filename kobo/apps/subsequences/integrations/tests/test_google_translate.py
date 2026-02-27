from unittest.mock import MagicMock, patch

from constance.test import override_config
from django.test import TestCase

from kobo.apps.languages.models.language import Language, LanguageRegion
from kobo.apps.languages.models.transcription import (
    TranscriptionService,
    TranscriptionServiceLanguageM2M,
)
from kobo.apps.languages.models.translation import (
    TranslationService,
    TranslationServiceLanguageM2M,
)
from kobo.apps.subsequences.constants import GOOGLE_CODE
from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError
from kobo.apps.subsequences.integrations.google.google_translate import (
    GoogleTranslationService,
)
from kpi.models import Asset


class TestGoogleTranslate(TestCase):

    fixtures = ['test_data']

    @override_config(ASR_MT_GOOGLE_PROJECT_ID='abc')
    def test_return_error_if_timeout(self):
        a = Asset.objects.get(pk=2)

        mock_client = MagicMock
        mock_client.bucket = MagicMock()
        mock_tsc = MagicMock()
        mock_tsc.batch_translate_text = MagicMock(side_effect=SubsequenceTimeoutError())
        submission = {
            '_id': 13,
            'formhub/uuid': 'cdf8ecb909d04b51bac4c04f6517bd6e',
            'audio': 'longerrecording-13_0_56.mp3',
            'meta/instanceID': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            '_xform_id_string': Asset.objects.get(pk=2).uid,
            '_uuid': '2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            'meta/rootUuid': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
        }
        en = Language.objects.create(name='English', code='en')
        es = Language.objects.create(name='Spanish', code='es')
        en_region = LanguageRegion.objects.create(
            language=en, name='English', code='en'
        )
        es_region = LanguageRegion.objects.create(
            language=es, name='Spanish', code='es'
        )

        tss = TranscriptionService.objects.get(code=GOOGLE_CODE)
        txs = TranslationService.objects.get(code=GOOGLE_CODE)
        TranscriptionServiceLanguageM2M.objects.create(
            service=tss, language=en, region=en_region
        )
        TranslationServiceLanguageM2M.objects.create(
            service=txs, language=es, region=es_region
        )

        with patch(
            'kobo.apps.subsequences.integrations.google.google_translate.google_credentials_from_constance_config',
            return_value={},
        ):
            with patch(
                'kobo.apps.subsequences.integrations.google.base.google_credentials_from_constance_config',
                return_value={},
            ):
                with patch(
                    'kobo.apps.subsequences.integrations.google.base.storage.Client',
                    return_value=mock_client,
                ):
                    with patch(
                        'kobo.apps.subsequences.integrations.google.google_translate.translate.TranslationServiceClient',
                        return_value=MagicMock(),
                    ):
                        service = GoogleTranslationService(submission, a)
                        with patch.object(
                            service,
                            'translate_content',
                            MagicMock(side_effect=SubsequenceTimeoutError()),
                        ):
                            res = service.process_data(
                                'mock_xpath',
                                {
                                    'language': 'es',
                                    '_dependency': {
                                        'language': 'en',
                                        'value': ','.join(
                                            ['x' * (service.MAX_SYNC_CHARS + 1)]
                                        ),
                                    },
                                },
                            )

        assert res['status'] == 'failed'
        assert 'Timed out' in res['error']
