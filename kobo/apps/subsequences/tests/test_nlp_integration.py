import pytest

from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from model_bakery import baker
from unittest.mock import patch, Mock

from kpi.models import Asset
from ..actions.base import ACTION_NEEDED, PASSES
from ..actions.automatic_transcription import (
    AutomaticTranscriptionAction,
    REQUESTED_BY_USER,
    PENDING,
)
from ..constants import GOOGLETS, GOOGLETX
from ..models import SubmissionExtras

TEST_TRANSCRIPTION_SERVICES = [
    'acme_1_speech2text',
    'optimus_transcribers',
    'wonka_stenographers',
]


class NLPIntegrationTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        user = baker.make(
            settings.AUTH_USER_MODEL,
            username='johndoe',
            date_joined=timezone.now(),
        )

        self.asset = Asset.objects.create(
            owner=user, content={
                'survey': [
                    {'type': 'audio', 'name': 'ask_a_question'}
                ]
            }
        )
        self.asset.advanced_features = {
            'transcript': {'languages': ['en']},
            'translation': {'languages': ['en', 'es']},
        }

    def test_param_builder(self):
        AutomaticTranscriptionAction.TRANSCRIPTION_SERVICES = TEST_TRANSCRIPTION_SERVICES
        survey = self.asset.content
        built_params = AutomaticTranscriptionAction.build_params({}, survey)
        assert built_params['values'] == ['ask_a_question']
        assert 'services' in built_params


    def test_instantiate_action_with_params(self):
        survey = self.asset.content
        action_params = AutomaticTranscriptionAction.build_params({}, survey)
        action_instance = AutomaticTranscriptionAction(action_params)
        assert action_instance is not None

    @pytest.mark.skip(reason='transcription currently does not depend on this working')
    def test_submission_status_before_change():
        survey = self.asset.content
        submission = {'ask_a_question': 'blah.mp3', '_attachments': [
            {'filename': 'blah.mp3', }
        ]}
        action_params = AutomaticTranscriptionAction.build_params({}, survey)
        action_instance = AutomaticTranscriptionAction(action_params)

        # check that the changes ARE needed
        assert action_instance.check_submission_status(submission) == ACTION_NEEDED

        # run the change on the submission
        submission = action_instance.run_change(submission)
        # # check that the changes are NO LONGER needed
        assert action_instance.check_submission_status(submission) == PASSES

        # a user indicating they want an automatic trancription changes the value
        # in the submission._supplementalDetails from NOT_REQUESTED to REQUESTED_BY_USER
        sdeets = submission['_supplementalDetails']
        example_fs_key = [*sdeets.keys()][0]
        sdeets[example_fs_key] = REQUESTED_BY_USER
        assert action_instance.check_submission_status(submission) == ACTION_NEEDED

        submission = action_instance.run_change(submission)
        assert action_instance.check_submission_status(submission) == PASSES
        sdeets = submission['_supplementalDetails']
        example_fs_key = [*sdeets.keys()][0]
        assert sdeets[example_fs_key] == PENDING

    @patch('kobo.apps.subsequences.integrations.google.google_transcribe.GoogleTranscriptionService')
    @patch('kobo.apps.subsequences.integrations.google.google_translate.GoogleTranslationService')
    def test_transcription_requested(
        self,
        mock_TranslationService,
        mock_TranscriptionService,
    ):
        mock_transcript_object = Mock(process_data=Mock(return_value={}))
        mock_TranscriptionService.return_value = mock_transcript_object

        submission = SubmissionExtras.objects.create(
            asset = self.asset,
            submission_uuid='123abc',
            content={
                'ask_a_question': {
                    GOOGLETS: {
                        'status': 'requested', 'languageCode': 'en'
                    }
                }
            }
        )
        assert mock_transcript_object.process_data.call_count == 1

        mock_translation_object = Mock(process_data=Mock(return_value={}))
        mock_TranslationService.return_value = mock_translation_object

        submission = SubmissionExtras.objects.create(
            asset = self.asset,
            submission_uuid='1234abcd',
            content={
                'ask_a_question': {
                    GOOGLETX: {
                        'status':'requested','languageCode':'en'
                    }
                }
            }
        )
        assert mock_translation_object.process_data.call_count == 1
