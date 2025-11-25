from unittest.mock import MagicMock, patch

from rest_framework import status

from kobo.apps.subsequences.models import SubmissionSupplement
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase
from kobo.apps.subsequences.tests.constants import QUESTION_SUPPLEMENT


class SubmissionSupplementAPITestCase(SubsequenceBaseTestCase):

    def test_cannot_patch_if_action_is_invalid(self):
        payload = {
            '_version': '20250820',
            'q1': {
                'manual_translation': {
                    'language': 'es',
                    'value': 'buenas noches',
                }
            },
        }

        # No actions activated for q1
        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid action' in str(response.data)

        # Activate manual transcription (even if payload asks for translation)
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'manual_transcription': [
                            {'language': 'es'},
                        ]
                    }
                },
            }
        )
        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid action' in str(response.data)

    def test_cannot_patch_with_invalid_payload(self):
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'manual_transcription': [
                            {'language': 'es'},
                        ]
                    }
                },
            }
        )

        payload = {
            '_version': '20250820',
            'q1': {
                'manual_translation': {
                    'languageCode': 'es',  # wrong attribute
                    'value': 'buenas noches',
                }
            },
        }

        response = self.client.patch(
            self.supplement_details_url, data=payload, format='json'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Invalid action' in str(response.data)

    def test_cannot_set_value_with_automatic_actions(self):
        # First, set up the asset to allow automatic actions
        advanced_features = {
            '_version': '20250820',
            '_actionConfigs': {
                'q1': {
                    'automatic_google_transcription': [
                        {'language': 'en'},
                    ],
                    'automatic_google_translation': [
                        {'language': 'fr'},
                    ]
                }
            },
        }
        self.set_asset_advanced_features(advanced_features)

        # Simulate a completed transcription, first.
        mock_submission_supplement = {
            '_version': '20250820',
            'q1': QUESTION_SUPPLEMENT
        }

        SubmissionSupplement.objects.create(
            submission_uuid=self.submission_uuid,
            content=mock_submission_supplement,
            asset=self.asset,
        )
        automatic_actions = advanced_features['_actionConfigs']['q1'].keys()
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


    def test_cannot_accept_incomplete_automatic_transcription(self):
        # Set up the asset to allow automatic google transcription
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'automatic_google_transcription': [
                            {'language': 'es'},
                        ]
                    }
                },
            }
        )

        # Try to set 'accepted' status when translation is not complete
        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_transcription': {
                    'language': 'es',
                    'accepted': True,
                }
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

    def test_cannot_accept_incomplete_automatic_translation(self):
        # Set up the asset to allow automatic google actions
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'automatic_google_transcription': [
                            {'language': 'en'},
                        ],
                        'automatic_google_translation': [
                            {'language': 'fr'},
                        ]
                    }
                },
            }
        )

        # Simulate a completed transcription, first.
        mock_submission_supplement = {
            '_version': '20250820',
            'q1': QUESTION_SUPPLEMENT
        }
        SubmissionSupplement.objects.create(
            submission_uuid=self.submission_uuid,
            content=mock_submission_supplement,
            asset=self.asset,
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

    def test_cannot_request_translation_without_transcription(self):
        # Set up the asset to allow automatic google actions
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'automatic_google_transcription': [
                            {'language': 'en'},
                        ],
                        'automatic_google_translation': [
                            {'language': 'fr'},
                        ]
                    }
                },
            }
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
