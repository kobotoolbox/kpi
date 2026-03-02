import uuid
from unittest.mock import patch

from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.tasks import poll_run_external_process_failure


from kobo.apps.subsequences.tasks import poll_run_external_process
from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError


class TestPollRunExternalProcess(BaseTestCase):
    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        super().setUp()
        self.asset = Asset.objects.get(uid='aNp9yMt4zKpUtTeZUnozYG')
        self.question_xpath = 'audio_question'
        self.action_id = Action.AUTOMATIC_GOOGLE_TRANSCRIPTION

        self.feature, _ = QuestionAdvancedFeature.objects.get_or_create(
            asset=self.asset,
            action=self.action_id,
            question_xpath=self.question_xpath,
            defaults={'params': [{'language': 'en'}]}
        )

        self.client.force_login(self.asset.owner)
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.submission_uuid = str(uuid.uuid4())
        submission_data = {
            self.question_xpath: 'audio.mp3',
            '_uuid': self.submission_uuid,
            '_submitted_by': 'someuser',
        }
        self.asset.deployment.mock_submissions([submission_data])
        self.submission = {'meta/rootUuid': self.submission_uuid}

    @patch('kobo.apps.subsequences.actions.base.BaseAutomaticNLPAction.run_external_process')  # noqa: E501
    def test_poll_raises_timeout_error_when_in_progress(self, mock_run):
        """
        Test that if the external service is still processing, the polling task
        correctly raises a SubsequenceTimeoutError to trigger a Celery retry
        """
        # Simulate the external service still processing
        mock_run.return_value = {'status': 'in_progress', 'language': 'en'}

        # The task should raise the error to trigger Celery's autoretry
        with self.assertRaises(SubsequenceTimeoutError):
            poll_run_external_process(
                asset_id=self.asset.id,
                submission=self.submission,
                question_xpath=self.question_xpath,
                action_id=self.action_id,
                action_data={'language': 'en'}
            )

    @patch('kobo.apps.subsequences.actions.base.BaseAutomaticNLPAction.run_external_process')  # noqa: E501
    def test_poll_completes_successfully(self, mock_run):
        """
        Test that if the external service has finished, the polling task
        exits silently without raising an error
        """
        # Simulate the external service finishing successfully
        mock_run.return_value = {
            'status': 'complete', 'value': 'Done!', 'language': 'en'
        }

        # The task should complete without raising any exceptions
        try:
            poll_run_external_process(
                asset_id=self.asset.id,
                submission=self.submission,
                question_xpath=self.question_xpath,
                action_id=self.action_id,
                action_data={'language': 'en'}
            )
        except Exception as e:
            self.fail(f'poll_run_external_process raised an unexpected exception: {e}')

        # Verify that the DB was updated with the 'complete' status and value
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        latest_version = (
            supplement_data[self.question_xpath][self.action_id]['_versions'][0]
        )
        self.assertEqual(latest_version['_data']['status'], 'complete')
        self.assertEqual(latest_version['_data']['value'], 'Done!')

    @patch('kobo.apps.subsequences.actions.base.BaseAutomaticNLPAction.run_external_process')  # noqa: E501
    def test_poll_handles_graceful_api_failure(self, mock_run):
        """
        Test that if the external API returns a clean failure, the task gracefully
        saves the 'failed' state and exits normally without crashing or triggering
        the Celery task_failure handler
        """
        error_msg = 'Audio file was corrupted'
        mock_run.return_value = {
            'status': 'failed', 'error': error_msg, 'language': 'en'
        }

        # The task should complete without raising any exceptions
        poll_run_external_process(
            asset_id=self.asset.id,
            submission=self.submission,
            question_xpath=self.question_xpath,
            action_id=self.action_id,
            action_data={'language': 'en'}
        )

        # Check that the DB successfully saved the 'failed' status and error
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        latest_version = (
            supplement_data[self.question_xpath][self.action_id]['_versions'][0]
        )
        self.assertEqual(latest_version['_data']['status'], 'failed')
        self.assertEqual(latest_version['_data']['error'], error_msg)


class TestPollRunExternalProcessFailure(BaseTestCase):
    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        super().setUp()
        self.asset = Asset.objects.get(uid='aNp9yMt4zKpUtTeZUnozYG')
        self.question_xpath = 'audio_question'
        self.action_id = Action.AUTOMATIC_GOOGLE_TRANSCRIPTION

        # Setup the advanced feature for the test question and action
        self.feature, _ = QuestionAdvancedFeature.objects.get_or_create(
            asset=self.asset,
            action=self.action_id,
            question_xpath=self.question_xpath,
            defaults={'params': [{'language': 'en'}]}
        )

        # Create a mock submission
        self.client.force_login(self.asset.owner)
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.submission_uuid = str(uuid.uuid4())
        submission_data = {
            self.question_xpath: 'audio.mp3',
            '_uuid': self.submission_uuid,
            '_submitted_by': 'someuser',
        }
        self.asset.deployment.mock_submissions([submission_data])
        self.submission = {'meta/rootUuid': self.submission_uuid}

        # Setup initial 'in_progress' state in the SubmissionSupplement
        incoming_data = {
            '_version': '20250820',
            self.question_xpath: {
                self.action_id: {'language': 'en'}
            }
        }

        # Patch the external process briefly just so the initial revise_data call
        # saves an 'in_progress' status to the database, simulating a running task
        with patch(
            'kobo.apps.subsequences.actions.base.BaseAutomaticNLPAction.run_external_process'  # noqa: E501
        ) as mock_run:
            mock_run.return_value = {'status': 'in_progress', 'language': 'en'}
            SubmissionSupplement.revise_data(self.asset, self.submission, incoming_data)

        # Prepare kwargs that Celery passes to the task failure signal
        self.task_kwargs = {
            'kwargs': {
                'asset_id': self.asset.id,
                'submission': self.submission,
                'question_xpath': self.question_xpath,
                'action_id': self.action_id,
                'action_data': {'language': 'en'},
            }
        }

    def test_failure_handler_generic_error(self):
        """
        Test that a generic exception correctly updates the actual database record
        with a 'failed' status and the exact error message
        """
        error_message = 'API quota exceeded for external service'
        generic_error = Exception(error_message)

        # Trigger the failure handler
        poll_run_external_process_failure(
            sender=None, exception=generic_error, **self.task_kwargs
        )

        # Fetch the updated supplement data from the real database
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )

        # Verify the newest version in the DB has the failed status and error
        latest_version = (
            supplement_data[self.question_xpath][self.action_id]['_versions'][0]
        )
        self.assertEqual(latest_version['_data']['status'], 'failed')
        self.assertEqual(latest_version['_data']['error'], error_message)

    def test_failure_handler_timeout_error_rewrite(self):
        """
        Test that if the Celery task exhausts its max retries, the internal timeout
        error string is intercepted and rewritten to a user-friendly message
        """
        timeout_error = Exception(
            f'{self.action_id} is still in progress for '
            f'submission {self.submission_uuid}'
        )

        # Trigger the failure handler
        poll_run_external_process_failure(
            sender=None, exception=timeout_error, **self.task_kwargs
        )

        # Fetch the updated supplement data from the real database
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )

        # Verify the error message was properly rewritten in the DB
        latest_version = (
            supplement_data[self.question_xpath][self.action_id]['_versions'][0]
        )
        self.assertEqual(latest_version['_data']['status'], 'failed')
        self.assertEqual(latest_version['_data']['error'], 'Maximum retries exceeded.')
