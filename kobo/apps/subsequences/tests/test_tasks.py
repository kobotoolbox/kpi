import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.models import (
    BulkActionItemStatus,
    BulkActionStatus,
    PENDING_OPERATION_MARKER,
    QuestionAdvancedFeature,
    SubmissionSupplement,
    SubsequenceBulkAction,
)
from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.tasks import poll_run_external_process_failure


from kobo.apps.subsequences.tasks import (
    poll_run_external_process,
    resume_stuck_bulk_actions,
    start_bulk_item_job,
    update_batch_status,
)
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


class TestSubsequenceBulkActionExecution(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        self.owner = User.objects.get(username='someuser')
        self.asset = Asset(
            owner=self.owner,
            content={'survey': [{'type': 'audio', 'label': 'q1', 'name': 'q1'}]},
        )
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        self.question_xpath = 'q1'
        self.action_id = Action.AUTOMATIC_GOOGLE_TRANSCRIPTION
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            action=self.action_id,
            question_xpath=self.question_xpath,
            params=[{'language': 'en'}],
        )
        self.submission_uuid = str(uuid.uuid4())
        self.second_submission_uuid = str(uuid.uuid4())
        self.asset.deployment.mock_submissions(
            [
                {
                    self.question_xpath: 'audio-1.mp3',
                    '_uuid': self.submission_uuid,
                    '_submitted_by': self.owner.username,
                },
                {
                    self.question_xpath: 'audio-2.mp3',
                    '_uuid': self.second_submission_uuid,
                    '_submitted_by': self.owner.username,
                },
            ]
        )
        self.bulk_action = SubsequenceBulkAction.create_with_items(
            asset=self.asset,
            action_id=self.action_id,
            question_xpath=self.question_xpath,
            params={'language': 'en'},
            created_by=self.owner.username,
            submission_root_uuids=[
                self.submission_uuid,
                self.second_submission_uuid,
            ],
        )

    @override_settings(
        BULK_ACTION_RATE_LIMITS={
            Action.AUTOMATIC_GOOGLE_TRANSCRIPTION: {'max_jobs_per_minute': 120}
        },
        BULK_ACTION_STATUS_POLL_INTERVAL=17,
    )
    def test_start_batch_transitions_and_schedules_tasks(self):
        """
        Test that start_batch moves the parent and items to in_progress and
        schedules item execution plus parent polling after commit
        """
        old_modified = timezone.now() - timedelta(minutes=5)
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            date_modified=old_modified
        )

        with patch(
            'kobo.apps.subsequences.tasks.start_bulk_item_job.apply_async'
        ) as enqueue_item_job, patch(
            'kobo.apps.subsequences.tasks.update_batch_status.apply_async'
        ) as enqueue_batch_poll:
            with self.captureOnCommitCallbacks(execute=True):
                self.bulk_action.start_batch()

        self.bulk_action.refresh_from_db()
        item_statuses = set(
            self.bulk_action.items.values_list('status', flat=True)
        )
        self.assertEqual(self.bulk_action.status, BulkActionStatus.IN_PROGRESS)
        self.assertGreater(self.bulk_action.date_modified, old_modified)
        self.assertEqual(item_statuses, {BulkActionItemStatus.IN_PROGRESS})
        self.assertEqual(enqueue_item_job.call_count, 2)
        self.assertEqual(
            enqueue_item_job.call_args_list[0].kwargs['countdown'],
            0,
        )
        self.assertEqual(
            enqueue_item_job.call_args_list[1].kwargs['countdown'],
            0.5,
        )
        enqueue_batch_poll.assert_called_once_with(
            args=(self.bulk_action.pk,),
            countdown=17,
        )

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_marks_item_complete(self, mock_run_external_process):
        """
        Test that a completed service result marks the child item complete and
        writes the completed supplement version
        """
        mock_run_external_process.return_value = {
            'status': 'complete',
            'value': 'Done!',
            'language': 'en',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])

        with patch('kobo.apps.subsequences.tasks.update_batch_status.delay') as delay:
            start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.COMPLETE)
        delay.assert_not_called()
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset,
            submission_root_uuid=self.submission_uuid,
        )
        latest_version = supplement_data[self.question_xpath][self.action_id][
            '_versions'
        ][0]
        self.assertEqual(latest_version['_data']['status'], 'complete')

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_keeps_item_in_progress_for_async_work(
        self,
        mock_run_external_process,
    ):
        """
        Test that an in-progress service result keeps the child item active and
        schedules the shared async poller
        """
        mock_run_external_process.return_value = {
            'status': 'in_progress',
            'language': 'en',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])

        with patch(
            'kobo.apps.subsequences.tasks.poll_run_external_process.apply_async'
        ) as enqueue_poll, patch(
            'kobo.apps.subsequences.tasks.update_batch_status.delay'
        ) as delay:
            start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.IN_PROGRESS)
        delay.assert_not_called()
        enqueue_poll.assert_called_once()

    @override_settings(BULK_ACTION_STUCK_THRESHOLD=60)
    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_skips_recent_pending_operation_marker(
        self,
        mock_run_external_process,
    ):
        """
        Test that if an item is marked as 'pending' with a recent timestamp, a
        concurrent worker will recognize another worker is currently waiting for
        Google to reply, and will safely abort without duplicating requests
        """
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])
        item.status = BulkActionItemStatus.IN_PROGRESS
        item.service_id = PENDING_OPERATION_MARKER
        item.save(update_fields=['status', 'service_id'])

        with patch(
            'kobo.apps.subsequences.tasks.poll_run_external_process.apply_async'
        ) as enqueue_poll:
            start_bulk_item_job(item.pk)

        mock_run_external_process.assert_not_called()
        enqueue_poll.assert_not_called()
        item.refresh_from_db()
        self.assertEqual(item.service_id, PENDING_OPERATION_MARKER)

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_resumes_polling_for_existing_operation(
        self,
        mock_run_external_process,
    ):
        """
        Test that if a worker crashes after sending a file to Google but before
        polling finishes, a rescuing worker will see the existing Operation ID
        and resume polling, rather than starting a duplicate transcription request
        """
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])
        item.status = BulkActionItemStatus.IN_PROGRESS
        item.service_id = 'operations/google-op-1'
        item.save(update_fields=['status', 'service_id'])

        with patch(
            'kobo.apps.subsequences.tasks.poll_run_external_process.apply_async'
        ) as enqueue_poll:
            start_bulk_item_job(item.pk)

        mock_run_external_process.assert_not_called()
        enqueue_poll.assert_called_once()
        item.refresh_from_db()
        self.assertEqual(item.service_id, 'operations/google-op-1')

    @patch(
        'kobo.apps.subsequences.models.SubmissionSupplement.revise_data'
    )
    def test_start_bulk_item_job_preserves_operation_saved_by_service(
        self,
        mock_revise_data,
    ):
        """
        Test that the Celery task does not accidentally overwrite the real Google
        Operation ID in the database with a blank string after a successful external
        API call
        """
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])

        def revise_data(*args, **kwargs):
            type(item).objects.filter(pk=item.pk).update(
                service_id='operations/google-op-1'
            )
            return {
                '_version': '20250820',
                self.question_xpath: {
                    self.action_id: {
                        '_versions': [
                            {
                                '_data': {
                                    'status': 'in_progress',
                                    'language': 'en',
                                }
                            }
                        ]
                    }
                },
            }

        mock_revise_data.side_effect = revise_data

        with patch(
            'kobo.apps.subsequences.tasks.poll_run_external_process.apply_async'
        ):
            start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.IN_PROGRESS)
        self.assertEqual(item.service_id, 'operations/google-op-1')

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_processes_pending_item_for_running_parent(
        self,
        mock_run_external_process,
    ):
        """
        Test that a pending child item can self-heal and run when its parent is
        already in progress
        """
        mock_run_external_process.return_value = {
            'status': 'complete',
            'value': 'Done!',
            'language': 'en',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            status=BulkActionStatus.IN_PROGRESS,
        )

        start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.COMPLETE)

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_marks_item_failed(
        self,
        mock_run_external_process,
    ):
        """
        Test that a failed service result marks the child item failed
        """
        mock_run_external_process.return_value = {
            'status': 'failed',
            'error': 'Transcription is not supported for language "en-US"',
            'language': 'en',
            'locale': 'en-US',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])

        start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.FAILED)

    def test_start_bulk_item_job_marks_item_failed_when_submission_lookup_raises(
        self,
    ):
        """
        Test that submission lookup errors mark the child item failed instead of
        leaving the batch active forever
        """
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])

        with patch(
            'kobo.apps.subsequences.tasks._get_submission_for_bulk_action_item',
            side_effect=RuntimeError('deployment unavailable'),
        ):
            start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.FAILED)

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_poll_run_external_process_updates_bulk_item_status(
        self,
        mock_run_external_process,
    ):
        """
        Test that the shared async poller mirrors a completed supplement status
        back to the matching bulk child item
        """
        mock_run_external_process.return_value = {
            'status': 'complete',
            'value': 'Done!',
            'language': 'en',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])
        item.status = BulkActionItemStatus.IN_PROGRESS
        item.save(update_fields=['status'])
        submission = {'meta/rootUuid': self.submission_uuid}

        poll_run_external_process(
            asset_id=self.asset.id,
            submission=submission,
            question_xpath=self.question_xpath,
            action_id=self.action_id,
            action_data={
                'language': 'en',
                'bulk_action_uid': self.bulk_action.uid,
            },
        )

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.COMPLETE)

    def test_poll_run_external_process_uses_saved_supplement_when_revise_data_returns_none(  # noqa: E501
        self,
    ):
        """
        Test that poll retries can read the existing supplement when revise_data
        has no new version to return
        """
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])
        item.status = BulkActionItemStatus.IN_PROGRESS
        item.save(update_fields=['status'])
        submission = {'meta/rootUuid': self.submission_uuid}

        with patch(
            'kobo.apps.subsequences.actions.base.'
            'BaseAutomaticNLPAction.run_external_process'
        ) as mock_run_external_process:
            mock_run_external_process.return_value = {
                'status': 'in_progress',
                'language': 'en',
            }
            SubmissionSupplement.revise_data(
                self.asset,
                submission,
                {
                    '_version': '20250820',
                    self.question_xpath: {
                        self.action_id: {
                            'language': 'en',
                            'bulk_action_uid': self.bulk_action.uid,
                        }
                    },
                },
            )

        with patch(
            'kobo.apps.subsequences.models.SubmissionSupplement.revise_data',
            return_value=None,
        ):
            with self.assertRaises(SubsequenceTimeoutError):
                poll_run_external_process(
                    asset_id=self.asset.id,
                    submission=submission,
                    question_xpath=self.question_xpath,
                    action_id=self.action_id,
                    action_data={
                        'language': 'en',
                        'bulk_action_uid': self.bulk_action.uid,
                    },
                )

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.IN_PROGRESS)

    def test_update_batch_status_marks_parent_complete(self):
        """
        Test that parent polling marks the batch complete once every child item
        reaches a terminal state
        """
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])
        old_modified = timezone.now() - timedelta(minutes=5)
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            date_modified=old_modified
        )
        self.bulk_action.items.filter(
            submission_root_uuid=self.submission_uuid
        ).update(status=BulkActionItemStatus.COMPLETE)
        self.bulk_action.items.filter(
            submission_root_uuid=self.second_submission_uuid
        ).update(status=BulkActionItemStatus.FAILED)

        with patch(
            'kobo.apps.subsequences.tasks.update_batch_status.apply_async'
        ) as reschedule:
            update_batch_status(self.bulk_action.pk)

        self.bulk_action.refresh_from_db()
        self.assertEqual(self.bulk_action.status, BulkActionStatus.COMPLETE)
        self.assertEqual(self.bulk_action.progress, 100)
        self.assertGreater(self.bulk_action.date_modified, old_modified)
        reschedule.assert_not_called()

    @override_settings(BULK_ACTION_STUCK_THRESHOLD=60)
    def test_resume_stuck_bulk_actions_requeues_batch_tasks(self):
        """
        Test that the watchdog restarts item processing and polling for stale
        in-progress batches
        """
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            date_modified=timezone.now() - timedelta(minutes=5)
        )

        with patch(
            'kobo.apps.subsequences.tasks.start_bulk_item_job.apply_async'
        ) as enqueue_item_job, patch(
            'kobo.apps.subsequences.tasks.update_batch_status.apply_async'
        ) as enqueue_batch_poll:
            resume_stuck_bulk_actions()

        self.assertEqual(enqueue_item_job.call_count, 2)
        enqueue_batch_poll.assert_called_once()
