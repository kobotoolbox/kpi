from copy import deepcopy
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from django.test import TestCase
from freezegun import freeze_time

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset
from ..constants import SUBMISSION_UUID_FIELD
from ..exceptions import InvalidAction, InvalidXPath
from ..models import SubmissionSupplement
from .constants import EMPTY_SUPPLEMENT


class SubmissionSupplementTestCase(TestCase):

    # Asset-level config.
    #   - Allow manual transcription for Arabic
    #   - Allow manual translation for English and Spanish
    ADVANCED_FEATURES = {
        '_version': '20250820',
        '_actionConfigs': {
            'group_name/question_name': {
                'manual_transcription': [{'language': 'ar'}],
                'manual_translation': [{'language': 'en'}, {'language': 'es'}],
            }
        },
    }

    EXPECTED_SUBMISSION_SUPPLEMENT = {
        '_version': '20250820',
        'group_name/question_name': {
            'manual_transcription': {
                '_dateCreated': '2024-04-08T15:27:00Z',
                '_dateModified': '2024-04-08T15:31:00Z',
                '_versions': [
                    {
                        'language': 'ar',
                        'value': 'فارغ',
                        '_dateCreated': '2024-04-08T15:31:00Z',
                        '_dateAccepted': '2024-04-08T15:31:00Z',
                    },
                    {
                        'language': 'ar',
                        'value': 'هائج',
                        '_dateCreated': '2024-04-08T15:27:00Z',
                        '_dateAccepted': '2024-04-08T15:27:00Z',
                    }
                ],
            },
            'manual_translation': {
                'en': {
                    '_dateCreated': '2024-04-08T15:27:00Z',
                    '_dateModified': '2024-04-08T15:27:00Z',
                    '_versions': [{
                        'language': 'en',
                        'value': 'berserk',
                        '_dateCreated': '2024-04-08T15:27:00Z',
                        '_dateAccepted': '2024-04-08T15:27:00Z',
                    }],
                },
                'es': {
                    '_dateCreated': '2024-04-08T15:29:00Z',
                    '_dateModified': '2024-04-08T15:32:00Z',
                    '_versions': [
                        {
                            'language': 'es',
                            'value': 'enloquecido',
                            '_dateCreated': '2024-04-08T15:32:00Z',
                            '_dateAccepted': '2024-04-08T15:32:00Z',
                        },
                        {
                            'language': 'es',
                            'value': 'loco',
                            '_dateCreated': '2024-04-08T15:29:00Z',
                            '_dateAccepted': '2024-04-08T15:29:00Z',
                        }
                    ],
                },
            },
        },
    }

    def setUp(self):
        # Create owner user
        self.owner = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='password',
        )

        # Create Asset with minimal advanced_features
        self.asset = Asset.objects.create(
            owner=self.owner,
            name='Test Asset',
            advanced_features=self.ADVANCED_FEATURES,
        )

        # Mock submission with minimal info needed for subsequence actions
        self.submission_root_uuid = '123e4567-e89b-12d3-a456-426614174000'
        self.submission = {
            SUBMISSION_UUID_FIELD: self.submission_root_uuid,
            'group_name/question_name': 'audio.m4a',
        }

    def test_retrieve_empty_data(self):
        assert (
            SubmissionSupplement.retrieve_data(self.asset, self.submission_root_uuid)
            == EMPTY_SUPPLEMENT
        )

    def test_retrieve_data_with_invalid_arguments(self):
        with pytest.raises(ValueError):
            SubmissionSupplement.retrieve_data(
                self.asset, submission_root_uuid=None, prefetched_supplement=None
            )

    def test_retrieve_data_with_stale_questions(self):
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_root_uuid,
            content=self.EXPECTED_SUBMISSION_SUPPLEMENT,
        )
        advanced_features = deepcopy(self.ADVANCED_FEATURES)
        config = advanced_features['_actionConfigs'].pop('group_name/question_name')
        advanced_features['_actionConfigs']['group_name/renamed_question_name'] = config
        submission_supplement = SubmissionSupplement.retrieve_data(
            self.asset, self.submission_root_uuid
        )
        assert submission_supplement == EMPTY_SUPPLEMENT

    def test_retrieve_data_from_migrated_data(self):
        submission_supplement = {
            'group_name/question_name': {
                'transcript': {
                    'languageCode': 'ar',
                    'value': 'فارغ',
                    'dateCreated': '2024-04-08T15:27:00Z',
                    'dateModified': '2024-04-08T15:31:00Z',
                    'revisions': [
                        {
                            'languageCode': 'ar',
                            'value': 'هائج',
                            'dateModified': '2024-04-08T15:27:00Z',
                        }
                    ],
                },
                'translation': [
                    {
                        'languageCode': 'en',
                        'value': 'berserk',
                        'dateCreated': '2024-04-08T15:27:00Z',
                        'dateModified': '2024-04-08T15:27:00Z',
                    },
                    {
                        'languageCode': 'es',
                        'value': 'enloquecido',
                        'dateCreated': '2024-04-08T15:29:00Z',
                        'dateModified': '2024-04-08T15:32:00Z',
                        'revisions': [
                            {
                                'languageCode': 'es',
                                'value': 'loco',
                                'dateModified': '2024-04-08T15:29:00Z',
                            }
                        ],
                    },
                ],
            },
        }

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_root_uuid,
            content=submission_supplement,
        )
        submission_supplement = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_root_uuid
        )
        assert submission_supplement == self.EXPECTED_SUBMISSION_SUPPLEMENT

    def test_retrieve_data_with_submission_root_uuid(self):
        self.test_revise_data()
        submission_supplement = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_root_uuid
        )
        assert submission_supplement == self.EXPECTED_SUBMISSION_SUPPLEMENT

    def test_revise_data(self):
        assert not SubmissionSupplement.objects.filter(
            submission_uuid=self.submission_root_uuid
        ).exists()

        frozen_datetime_now = datetime(2024, 4, 8, 15, 27, 0, tzinfo=ZoneInfo('UTC'))
        with freeze_time(frozen_datetime_now):

            # 1) First call with transcription (ar) and translation (en)
            SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    'group_name/question_name': {
                        'manual_transcription': {
                            'language': 'ar',
                            'value': 'هائج',
                        },
                        'manual_translation': {
                            'language': 'en',
                            'value': 'berserk',
                        },
                    },
                },
            )

        # Make sure a SubmissionSupplement object has been created
        assert SubmissionSupplement.objects.filter(
            submission_uuid=self.submission_root_uuid
        ).exists()

        # 2) Call with translation es = "loco"
        frozen_datetime_now = datetime(2024, 4, 8, 15, 29, 0, tzinfo=ZoneInfo('UTC'))
        with freeze_time(frozen_datetime_now):
            SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    'group_name/question_name': {
                        'manual_translation': {
                            'language': 'es',
                            'value': 'loco',
                        },
                    },
                },
            )

        assert (
            SubmissionSupplement.objects.filter(
                submission_uuid=self.submission_root_uuid
            ).count()
            == 1
        )

        # 3) Call with transcription ar = 'فارغ'
        frozen_datetime_now = datetime(2024, 4, 8, 15, 31, 0, tzinfo=ZoneInfo('UTC'))
        with freeze_time(frozen_datetime_now):
            submission_supplement = SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    'group_name/question_name': {
                        'manual_transcription': {
                            'language': 'ar',
                            'value': 'فارغ',
                        },
                    },
                },
            )

        # 4) Call with translation es = "enloquecido"
        frozen_datetime_now = datetime(2024, 4, 8, 15, 32, 0, tzinfo=ZoneInfo('UTC'))
        with freeze_time(frozen_datetime_now):
            submission_supplement = SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    'group_name/question_name': {
                        'manual_translation': {
                            'language': 'es',
                            'value': 'enloquecido',
                        },
                    },
                },
            )

        assert submission_supplement == self.EXPECTED_SUBMISSION_SUPPLEMENT

    def test_revise_data_raise_error_wrong_action(self):

        with pytest.raises(InvalidAction):
            SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    'group_name/question_name': {'my_other_action': {'param': 'foo'}},
                },
            )

    def test_revise_data_raise_error_wrong_question_name(self):

        with pytest.raises(InvalidXPath):
            SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    'group_name/other_question_name': {
                        'manual_translation': {
                            'language': 'en',
                            'value': 'crazy',
                        }
                    },
                },
            )
