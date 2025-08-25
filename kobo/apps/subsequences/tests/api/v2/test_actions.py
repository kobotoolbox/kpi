from rest_framework import status

from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase


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

        # No actions activated at the asset level
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
