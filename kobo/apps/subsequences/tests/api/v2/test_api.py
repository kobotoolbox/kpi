import uuid
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from mock import Mock
from rest_framework import status
from constance.test import override_config


from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.models import SubmissionSupplement
from kobo.apps.subsequences.tests.api.v2.base import SubsequenceBaseTestCase
from kobo.apps.subsequences.tests.constants import QUESTION_SUPPLEMENT
from kpi.utils.xml import fromstring_preserve_root_xmlns, edit_submission_xml, xml_tostring


class SubmissionSupplementAPITestCase(SubsequenceBaseTestCase):
    def setUp(self):
        super().setUp()
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'manual_transcription': [
                            {'language': 'en'},
                        ]
                    }
                },
            }
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
                }
            },
        }
        non_existent_supplement_details_url = reverse(
            self._get_endpoint('submission-supplement'),
            args=[self.asset.uid, 'bad-uuid'],
        )
        rr = self.client.patch(non_existent_supplement_details_url)
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
                }
            },
        }
        now = timezone.now()
        now_iso = now.isoformat().replace('+00:00','Z')
        with freeze_time(now):
            with patch('kobo.apps.subsequences.actions.base.uuid.uuid4', return_value='uuid1'):
                response = self.client.patch(
                    self.supplement_details_url, data=payload, format='json'
                )
        assert response.status_code == status.HTTP_200_OK

        expected_data = {'_version': '20250820',
         'q1': {'manual_transcription': {'_dateCreated': now_iso,
                                         '_dateModified': now_iso,
                                         '_versions': [{'_dateAccepted': now_iso,
                                                        '_dateCreated': now_iso,
                                                        '_uuid': 'uuid1',
                                                        'language': 'en',
                                                        'value': 'Hello world'}]}}}
        assert response.data == expected_data

    def test_change_language_list(self):
        field = self.txi.revise_field({
            'tx1': {
                'value': 'T1',
                'dateModified': 'A',
                'dateCreated': 'A',
                'revisions': []
            }
        }, {
            'tx2': {
                'value': 'T2',
            }
        })
        self.set_asset_advanced_features({
            'translation': {
                'languages': [
                    'tx1', 'tx3'
                ]
            }
        })
        resp = self.client.get(self.asset_url)
        schema = resp.json()['advanced_submission_schema']
        package = {
            'submission': self.submission_uuid,
            'q1': {
                'transcript': {
                    'value': 'they said hello',
                },
            },
        }
        # validate(package, schema)



class SubmissionSupplementAPIValidationTestCase(SubsequenceBaseTestCase):

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

class SubmissionSupplementAPIUsageLimitsTestCase(SubsequenceBaseTestCase):
    def setUp(self):
        super().setUp()
        self.set_asset_advanced_features(
            {
                '_version': '20250820',
                '_actionConfigs': {
                    'q1': {
                        'automatic_google_transcription': [
                            {'language': 'en'},
                        ],
                        'automatic_google_translation': [
                            {'language': 'es'},
                        ]
                    }
                },
            }
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_google_services_usage_limit_checks(self):
        payload = {
            '_version': '20250820',
            'q1': {
                'automatic_google_transcription': {
                    'language': 'en',
                    'status': 'requested',
                }
            },
        }
        mock_balances = {
            UsageType.ASR_SECONDS: {'exceeded': True},
            UsageType.MT_CHARACTERS: {'exceeded': True},
        }
        with patch(
            'kobo.apps.subsequences.api_view.ServiceUsageCalculator.get_usage_balances',
            return_value=mock_balances,
        ):
            response = self.client.patch(
                self.supplement_details_url, data=payload, format='json'
            )
        assert response.status_code == status.HTTP_402_PAYMENT_REQUIRED
