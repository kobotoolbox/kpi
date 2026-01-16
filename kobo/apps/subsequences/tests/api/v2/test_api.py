import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from constance.test import override_config
from ddt import data, ddt, unpack
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status

from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.actions.automatic_google_transcription import (
    AutomaticGoogleTranscriptionAction,
)
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase
from kobo.apps.subsequences.tests.constants import QUESTION_SUPPLEMENT
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)


class SubmissionSupplementAPITestCase(SubsequenceBaseTestCase):
    def setUp(self):
        super().setUp()

    def _simulate_completed_transcripts(self):
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'en'}],
        )

        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'en'}],
        )

        # Simulate a completed transcription, first.
        mock_submission_supplement = {'_version': '20250820', 'q1': QUESTION_SUPPLEMENT}
        SubmissionSupplement.objects.create(
            submission_uuid=self.submission_uuid,
            content=mock_submission_supplement,
            asset=self.asset,
        )

    def test_get_submission_with_nonexistent_instance_404s(self):
        non_existent_supplement_details_url = reverse(
            self._get_endpoint('submission-supplement'),
            args=[self.asset.uid, 'bad-uuid'],
        )
        rr = self.client.get(non_existent_supplement_details_url)
        assert rr.status_code == 404

    def test_patch_submission_with_nonexistent_instance_404s(self):
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    'language': 'en',
                    'value': 'Hello world',
                },
            },
        }
        non_existent_supplement_details_url = reverse(
            self._get_endpoint('submission-supplement'),
            args=[self.asset.uid, 'bad-uuid'],
        )
        rr = self.client.patch(
            non_existent_supplement_details_url, data=payload, format='json'
        )
        assert rr.status_code == 404

    def test_get_submission_after_edit(self):
        # Simulate edit
        instance = Instance.objects.only('pk').get(root_uuid=self.submission_uuid)
        deployment = self.asset.deployment
        new_uuid = str(uuid.uuid4())
        xml_parsed = fromstring_preserve_root_xmlns(instance.xml)
        edit_submission_xml(
            xml_parsed,
            deployment.SUBMISSION_DEPRECATED_UUID_XPATH,
            add_uuid_prefix(self.submission_uuid),
        )
        edit_submission_xml(
            xml_parsed,
            deployment.SUBMISSION_ROOT_UUID_XPATH,
            add_uuid_prefix(instance.root_uuid),
        )
        edit_submission_xml(
            xml_parsed,
            deployment.SUBMISSION_CURRENT_UUID_XPATH,
            add_uuid_prefix(new_uuid),
        )
        instance.xml = xml_tostring(xml_parsed)
        instance.uuid = new_uuid
        instance.save()
        assert instance.root_uuid == self.submission_uuid

        # Retrieve advanced submission schema for edited submission
        rr = self.client.get(self.supplement_details_url)
        assert rr.status_code == status.HTTP_200_OK

    def test_get_submission_with_null_root_uuid(self):
        # Simulate an old submission (never edited) where `root_uuid` was not yet set
        Instance.objects.filter(root_uuid=self.submission_uuid).update(root_uuid=None)
        rr = self.client.get(self.supplement_details_url)
        assert rr.status_code == status.HTTP_200_OK

    def test_asset_post_submission_extra_with_transcript(self):
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    'language': 'en',
                    'value': 'Hello world',
                },
            },
        }

        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'en'}],
        )

        now = timezone.now()
        now_iso = now.isoformat().replace('+00:00', 'Z')
        with freeze_time(now):
            with patch(
                'kobo.apps.subsequences.actions.base.uuid.uuid4', return_value='uuid1'
            ):
                response = self.client.patch(
                    self.supplement_details_url, data=payload, format='json'
                )
        assert response.status_code == status.HTTP_200_OK
        expected_data = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    '_dateCreated': now_iso,
                    '_dateModified': now_iso,
                    '_versions': [
                        {
                            '_data': {
                                'language': 'en',
                                'value': 'Hello world',
                            },
                            '_dateAccepted': now_iso,
                            '_dateCreated': now_iso,
                            '_uuid': 'uuid1',
                        }
                    ],
                },
            },
        }
        assert response.data == expected_data

    def test_valid_manual_transcription(self):
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    'language': 'en',
                    'value': 'hello world',
                },
            },
        }

        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'en'}],
        )

        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )

        assert response.status_code == status.HTTP_200_OK

    def test_valid_manual_translation(self):
        self._simulate_completed_transcripts()
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_translation',
            params=[{'language': 'es'}],
        )

        payload = {
            '_version': '20250820',
            'q1': {
                'manual_translation': {
                    'language': 'es',
                    'value': 'hola el mundo',
                },
            },
        }

        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )

        assert response.status_code == status.HTTP_200_OK

    def test_valid_automatic_transcription(self):
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'en'}],
        )

        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_transcription': {
                    'language': 'en',
                },
            },
        }

        # Mock GoogleTranscriptionService and simulate completed transcription
        mock_service = MagicMock()
        mock_service.process_data.return_value = {
            'status': 'complete',
            'value': 'hello world',
        }

        with patch(
            'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',  # noqa
            return_value=mock_service,
        ):
            response = self.client.patch(
                self.supplement_details_url, data=payload, format='json'
            )

        assert response.status_code == status.HTTP_200_OK

    def test_valid_automatic_translation(self):
        self._simulate_completed_transcripts()
        # Set up the asset to allow automatic google translation
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_translation',
            params=[{'language': 'es'}],
        )

        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_translation': {
                    'language': 'es',
                },
            },
        }

        # Mock GoogleTranslationService and simulate in progress translation
        mock_service = MagicMock()
        mock_service.process_data.return_value = {
            'status': 'complete',
            'value': 'hola el mundo',
        }

        with patch(
            'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
            return_value=mock_service,
        ):
            response = self.client.patch(
                self.supplement_details_url, data=payload, format='json'
            )

        assert response.status_code == status.HTTP_200_OK

    def test_cannot_set_value_with_automatic_actions(self):
        self._simulate_completed_transcripts()
        # Set up the asset to allow automatic actions
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_translation',
            params=[{'language': 'fr'}],
        )

        automatic_actions = self.asset.advanced_features_set.filter(
            question_xpath='q1'
        ).values_list('action', flat=True)
        for automatic_action in automatic_actions:
            payload = {
                '_version': '20250820',
                'q1': {
                    automatic_action: {
                        'language': 'es',
                        'value': 'some text',  # forbidden field
                    }
                },
            }
            response = self.client.patch(
                self.supplement_details_url, data=payload, format='json'
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert 'Invalid payload' in str(response.data)

    def test_cannot_accept_incomplete_automatic_translation(self):
        self._simulate_completed_transcripts()
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_translation',
            params=[{'language': 'fr'}],
        )

        # Try to set 'accepted' status when translation is not complete
        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_translation': {
                    'language': 'fr',
                    'accepted': True,
                }
            },
        }

        # Mock GoogleTranscriptionService and simulate in progress translation
        mock_service = MagicMock()
        mock_service.process_data.return_value = {'status': 'in_progress'}

        with patch(
            'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
            return_value=mock_service,
        ):
            response = self.client.patch(
                self.supplement_details_url, data=payload, format='json'
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert 'Invalid payload' in str(response.data)

    def test_retrieve_does_migrate_data(self):
        """
        The migration utils are already covered by other tests (`test_versioning.py),
        but we need to test that the correct value is return when fetching data from
        the API endpoint.
        """
        self.asset.known_cols = [
            'q1:transcript_auto_google:en',
            'q1:transcript:en',
            'q1:translation_auto_google:fr',
            'q1:translation:fr',
        ]

        self.asset.advanced_features = {
            'qual': {
                'qual_survey': [
                    {
                        'type': 'qual_select_multiple',
                        'uuid': 'b0bce6b0-9bf3-4f0f-a76e-4b3b4e9ba0e8',
                        'scope': 'by_question#survey',
                        'xpath': 'q1',
                        'labels': {'_default': 'Multiple Choice'},
                        'choices': [
                            {
                                'uuid': '35793589-556e-4872-b5eb-3b75e4dc4a99',
                                'labels': {'_default': 'Day'},
                            },
                            {
                                'uuid': 'efceb7be-c120-43b4-9d6c-48c3c8d393bc',
                                'labels': {'_default': 'Night'},
                            },
                        ],
                    },
                    {
                        'type': 'qual_select_one',
                        'uuid': 'c52ba63d-3202-44bc-8f55-159983e7f0d9',
                        'scope': 'by_question#survey',
                        'xpath': 'q1',
                        'labels': {'_default': 'Single choice'},
                        'choices': [
                            {
                                'uuid': '83212060-fd18-445a-b121-ad82c2e5811d',
                                'labels': {'_default': 'yes'},
                            },
                            {
                                'uuid': '394e7c6e-1468-4964-8d04-8d9bdd0d1746',
                                'labels': {'_default': 'no'},
                            },
                        ],
                    },
                    {
                        'type': 'qual_text',
                        'uuid': 'fd61cafc-9516-4063-8498-5eace89146a5',
                        'scope': 'by_question#survey',
                        'xpath': 'audio',
                        'labels': {'_default': 'Question?'},
                    },
                ]
            },
            'transcript': {'languages': ['en']},
            'translation': {'languages': ['fr']},
        }

        old_supplement_data = {
            'q1': {
                'qual': [
                    {
                        'val': 'Answer',
                        'type': 'qual_text',
                        'uuid': 'fd61cafc-9516-4063-8498-5eace89146a5',
                    },
                    {
                        'val': '83212060-fd18-445a-b121-ad82c2e5811d',
                        'type': 'qual_select_one',
                        'uuid': 'c52ba63d-3202-44bc-8f55-159983e7f0d9',
                    },
                    {
                        'val': [
                            '35793589-556e-4872-b5eb-3b75e4dc4a99',
                            'efceb7be-c120-43b4-9d6c-48c3c8d393bc',
                        ],
                        'type': 'qual_select_multiple',
                        'uuid': 'b0bce6b0-9bf3-4f0f-a76e-4b3b4e9ba0e8',
                    },
                ],
                'googlets': {
                    'value': 'Hello world',
                    'status': 'complete',
                    'regionCode': 'en-CA',
                    'languageCode': 'en',
                },
                'googletx': {
                    'value': 'Bonjour le monde',
                    'source': 'en',
                    'status': 'complete',
                    'languageCode': 'fr',
                },
                'transcript': {
                    'value': 'Hello world!',
                    'revisions': [
                        {
                            'value': 'Hello world',
                            'dateModified': '2025-12-11 23:57:21',
                            'languageCode': 'en',
                        }
                    ],
                    'dateCreated': '2025-12-12 00:03:23',
                    'dateModified': '2025-12-12 00:03:23',
                    'languageCode': 'en',
                },
                'translation': {
                    'fr': {
                        'value': 'Bonjour le monde!',
                        'revisions': [],
                        'dateCreated': '2025-12-12T00:04:38Z',
                        'dateModified': '2025-12-12T00:04:38Z',
                        'languageCode': 'fr',
                    }
                },
            }
        }

        # Simulate old data
        self.asset.save(
            update_fields=['advanced_features', 'known_cols'],
            create_version=False,
            adjust_content=False,
        )

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=old_supplement_data,
        )

        frozen_datetime_now = datetime(
            year=2025,
            month=12,
            day=15,
            hour=22,
            minute=22,
            second=0,
            tzinfo=ZoneInfo('UTC'),
        )

        result_mock_uuid_sequence = [
            'a9a817c0-7208-4063-bab6-93c0a3a7615b',
            '61d23cd7-ce2c-467b-ab26-0839226c714d',
            '20dd5185-ee43-451f-8759-2f5185c3c912',
            '409c690e-d148-4d80-8c73-51be941b33b0',
            '49fbd509-e042-44ce-843c-db04485a0096',
            '5799f662-76d7-49ab-9a1c-ae2c7d502a78',
            'c4fa8263-50c0-4252-9c9b-216ca338be13',
            '64e59cc1-adaf-47a3-a068-550854d8f98f',
            '909c62cf-d544-4926-8839-7f035c6c7483',
            '15ccc864-0e83-48f2-be1d-dc2adb9297f4',
            'f2b4c6b1-3c6a-4a7f-9e55-1a8c2a0a7c91',
            '8c9a8e44-7a3d-4c58-b7bb-5f2a1c6e5c3a',
        ]

        uuid_list = [uuid.UUID(u) for u in result_mock_uuid_sequence]

        with patch('uuid.uuid4', side_effect=uuid_list):
            with freeze_time(frozen_datetime_now):
                response = self.client.get(self.supplement_details_url, format='json')

        assert response.status_code == status.HTTP_200_OK

        expected_response = {
            'q1': {
                'manual_transcription': {
                    '_dateCreated': '2025-12-12 00:03:23',
                    '_dateModified': '2025-12-12 00:03:23',
                    '_versions': [
                        {
                            '_dateCreated': '2025-12-12 00:03:23',
                            '_data': {
                                'language': 'en',
                                'value': 'Hello world!',
                            },
                            '_uuid': 'c4fa8263-50c0-4252-9c9b-216ca338be13',
                            '_dateAccepted': '2025-12-15T22:22:00+00:00',
                        }
                    ],
                },
                'automatic_google_transcription': {
                    '_dateCreated': '2025-12-11 23:57:21',
                    '_dateModified': '2025-12-11 23:57:21',
                    '_versions': [
                        {
                            '_dateCreated': '2025-12-11 23:57:21',
                            '_data': {
                                'language': 'en',
                                'value': 'Hello world',
                                'status': 'complete',
                            },
                            '_uuid': '64e59cc1-adaf-47a3-a068-550854d8f98f',
                            '_dateAccepted': '2025-12-15T22:22:00+00:00',
                        }
                    ],
                },
                'manual_translation': {
                    'fr': {
                        '_dateCreated': '2025-12-12T00:04:38Z',
                        '_dateModified': '2025-12-12T00:04:38Z',
                        '_versions': [
                            {
                                '_dateCreated': '2025-12-12T00:04:38Z',
                                '_data': {
                                    'language': 'fr',
                                    'value': 'Bonjour le monde!',
                                },
                                '_uuid': '909c62cf-d544-4926-8839-7f035c6c7483',
                                '_dateAccepted': '2025-12-15T22:22:00+00:00',
                                '_dependency': {
                                    '_uuid': 'c4fa8263-50c0-4252-9c9b-216ca338be13',
                                    '_actionId': 'manual_transcription',
                                },
                            }
                        ],
                    }
                },
                'manual_qual': {
                    'fd61cafc-9516-4063-8498-5eace89146a5': {
                        '_dateCreated': '2025-12-15T22:22:00+00:00',
                        '_dateModified': '2025-12-15T22:22:00+00:00',
                        '_versions': [
                            {
                                '_data': {
                                    'uuid': 'fd61cafc-9516-4063-8498-5eace89146a5',
                                    'value': 'Answer',
                                },
                                '_dateCreated': '2025-12-15T22:22:00+00:00',
                                '_dateAccepted': '2025-12-15T22:22:00+00:00',
                                '_uuid': '15ccc864-0e83-48f2-be1d-dc2adb9297f4',
                            }
                        ],
                    },
                    'c52ba63d-3202-44bc-8f55-159983e7f0d9': {
                        '_dateCreated': '2025-12-15T22:22:00+00:00',
                        '_dateModified': '2025-12-15T22:22:00+00:00',
                        '_versions': [
                            {
                                '_data': {
                                    'uuid': 'c52ba63d-3202-44bc-8f55-159983e7f0d9',
                                    'value': '83212060-fd18-445a-b121-ad82c2e5811d',
                                },
                                '_dateCreated': '2025-12-15T22:22:00+00:00',
                                '_dateAccepted': '2025-12-15T22:22:00+00:00',
                                '_uuid': 'f2b4c6b1-3c6a-4a7f-9e55-1a8c2a0a7c91',
                            }
                        ],
                    },
                    'b0bce6b0-9bf3-4f0f-a76e-4b3b4e9ba0e8': {
                        '_dateCreated': '2025-12-15T22:22:00+00:00',
                        '_dateModified': '2025-12-15T22:22:00+00:00',
                        '_versions': [
                            {
                                '_data': {
                                    'uuid': 'b0bce6b0-9bf3-4f0f-a76e-4b3b4e9ba0e8',
                                    'value': [
                                        '35793589-556e-4872-b5eb-3b75e4dc4a99',
                                        'efceb7be-c120-43b4-9d6c-48c3c8d393bc',
                                    ],
                                },
                                '_dateCreated': '2025-12-15T22:22:00+00:00',
                                '_dateAccepted': '2025-12-15T22:22:00+00:00',
                                '_uuid': '8c9a8e44-7a3d-4c58-b7bb-5f2a1c6e5c3a',
                            }
                        ],
                    },
                },
            },
            '_version': '20250820',
        }
        assert response.data == expected_response

    def test_get_data_with_failed_transcription_no_value(self):
        """
        When a transcription fails (e.g., no audio attachment), the stored
        data may not have a 'value' field. Reading this data should not
        crash with a 500 error.
        """
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'fr'}],
        )
        # Create a mock submission supplement with no 'value' field
        failed_transcription_data = {
            'q1': {
                'automatic_google_transcription': {
                    '_dateCreated': '2026-01-11T01:29:00.908261Z',
                    '_dateModified': '2026-01-11T01:29:00.908261Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'en',
                                'status': 'failed',
                                'error': 'Any error',
                            },
                            '_dateCreated': '2026-01-11T01:29:00.908261Z',
                            '_uuid': '08668365-c922-48ea-9f0e-26935ca2755e',
                        }
                    ],
                }
            },
            '_version': '20250820',
        }

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=failed_transcription_data,
        )
        data_url = reverse(self._get_endpoint('submission-list'), args=[self.asset.uid])
        response = self.client.get(data_url, format='json')
        assert response.status_code == status.HTTP_200_OK


class SubmissionSupplementAPIValidationTestCase(SubsequenceBaseTestCase):

    def test_cannot_patch_if_question_has_no_configured_actions(self):
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_translation': {
                    'language': 'es',
                    'value': 'buenas noches',
                },
            },
        }

        # No actions activated at the asset level for any questions
        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid action' in str(response.data)

    def test_cannot_patch_if_action_is_invalid(self):
        # Activate manual transcription (even though payload asks for translation)
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_translation': {
                    'language': 'es',
                    'value': 'buenas noches',
                },
            },
        }

        # No actions activated for q1
        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid action' in str(response.data)

        # Activate manual transcription (even if payload asks for translation)
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'es'}],
        )

        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid action' in str(response.data)

    def test_cannot_patch_with_invalid_payload(self):
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'es'}],
        )

        payload = {
            '_version': '20250820',
            'q1': {
                'manual_translation': {
                    'languageCode': 'es',  # wrong attribute
                    'value': 'buenas noches',
                },
            },
        }

        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid action' in str(response.data)

    def test_cannot_accept_incomplete_automatic_transcription(self):
        # Set up the asset to allow automatic google transcription
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'es'}],
        )

        # Try to set 'accepted' status when translation is not complete
        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_transcription': {
                    'language': 'es',
                    'accepted': True,
                },
            },
        }

        # Mock GoogleTranscriptionService and simulate in progress transcription
        mock_service = MagicMock()
        mock_service.process_data.return_value = {'status': 'in_progress'}

        with patch(
            'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',  # noqa
            return_value=mock_service,
        ):
            response = self.client.patch(
                self.supplement_details_url, data=payload, format='json'
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert 'Invalid payload' in str(response.data)

    def test_cannot_request_translation_without_transcription(self):
        # Set up the asset to allow automatic google actions
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'en'}],
        )
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_translation',
            params=[{'language': 'fr'}],
        )
        # Try to ask for translation
        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_translation': {
                    'language': 'fr',
                }
            },
        }

        # Mock GoogleTranscriptionService and simulate in progress translation
        mock_service = MagicMock()
        mock_service.process_data.return_value = {'status': 'in_progress'}

        with patch(
            'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
            return_value=mock_service,
        ):
            response = self.client.patch(
                self.supplement_details_url, data=payload, format='json'
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert 'Cannot translate without transcription' in str(response.data)

    def test_cannot_delete_non_existent_transcription(self):
        """
        Users should not be able to delete a transcription from a submission
        that doesn't have an existing transcription to begin with.
        Setting `value: null` on a non-existent transcription should return 400.
        """
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='manual_transcription',
            params=[{'language': 'en'}],
        )

        # Attempt to "delete" a non-existent transcription
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_transcription': {
                    'language': 'en',
                    'value': None,
                },
            },
        }

        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
        # Should fail because there's nothing to delete
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Subsequence deletion error' in str(response.data)

        # Verify no entry was created
        supplement = SubmissionSupplement.objects.filter(
            submission_uuid=self.submission_uuid, asset=self.asset
        ).first()
        assert 'q1' not in supplement.content

        payload['q1']['manual_transcription']['value'] = 'test value'
        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )

        payload['q1']['manual_transcription']['value'] = None
        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
        # Should not fail because there's something to delete
        assert response.status_code == status.HTTP_200_OK
        supplement.refresh_from_db()
        assert 'q1' in supplement.content

    def test_cannot_delete_non_existent_automatic_transcription(self):
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'en'}],
        )

        # Create a mock submission supplement with no 'value' field
        failed_transcription_data = {
            'q1': {
                'automatic_google_transcription': {
                    '_dateCreated': '2026-01-11T01:29:00.908261Z',
                    '_dateModified': '2026-01-11T01:29:00.908261Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'en',
                                'status': 'failed',
                                'error': 'Any error',
                            },
                            '_dateCreated': '2026-01-11T01:29:00.908261Z',
                            '_uuid': '08668365-c922-48ea-9f0e-26935ca2755e',
                        }
                    ],
                }
            },
            '_version': '20250820',
        }

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            content=failed_transcription_data,
        )

        # Attempt to "delete" a non-existent transcription
        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_transcription': {
                    'language': 'en',
                    'value': None,
                },
            },
        }

        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
        # Should fail because there's nothing to delete
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@ddt
class SubmissionSupplementAPIUsageLimitsTestCase(SubsequenceBaseTestCase):
    def setUp(self):
        super().setUp()
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_transcription',
            params=[{'language': 'en'}],
        )
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath='q1',
            action='automatic_google_translation',
            params=[{'language': 'es'}],
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    @data(
        (True, status.HTTP_402_PAYMENT_REQUIRED),
        (False, status.HTTP_200_OK),
    )
    @unpack
    def test_google_services_usage_limit_checks(
        self, usage_limit_enforcement, expected_result_code
    ):
        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_transcription': {
                    'language': 'en',
                },
            },
        }
        mock_balances = {
            UsageType.ASR_SECONDS: {'exceeded': True},
            UsageType.MT_CHARACTERS: {'exceeded': True},
        }

        with patch(
            'kobo.apps.subsequences.actions.base.ServiceUsageCalculator.get_usage_balances',  # noqa
            return_value=mock_balances,
        ):
            with override_config(USAGE_LIMIT_ENFORCEMENT=usage_limit_enforcement):
                with patch.object(
                    AutomaticGoogleTranscriptionAction,
                    'run_external_process',
                    return_value=None,  # noqa
                ):
                    response = self.client.patch(
                        self.supplement_details_url, data=payload, format='json'
                    )
                    assert response.status_code == expected_result_code
