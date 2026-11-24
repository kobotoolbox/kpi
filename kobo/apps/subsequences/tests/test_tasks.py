import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, PropertyMock, patch

import constance
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError
from kobo.apps.subsequences.integrations.google.google_transcribe import (
    GoogleTranscriptionService,
)
from kobo.apps.subsequences.models import (
    PENDING_OPERATION_MARKER,
    BulkActionItemStatus,
    BulkActionStatus,
    QuestionAdvancedFeature,
    SubmissionSupplement,
    SubsequenceBulkAction,
    TranscriptionChunk,
)
from kobo.apps.subsequences.tasks import (
    poll_run_external_process,
    poll_run_external_process_failure,
    resume_stuck_bulk_actions,
    start_bulk_item_job,
    update_batch_status,
)
from kobo.celery import celery_app
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.audio_chunking import ChunkRange


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

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_poll_auto_accepts_completed_result(self, mock_run):
        """
        Test that a completed result polled with auto_accept is stamped accepted
        and that the request-only flag never reaches the persisted version data
        """
        mock_run.return_value = {
            'status': 'complete',
            'value': 'Done!',
            'language': 'en',
        }

        poll_run_external_process(
            asset_id=self.asset.id,
            submission=self.submission,
            question_xpath=self.question_xpath,
            action_id=self.action_id,
            action_data={'language': 'en', 'auto_accept': True},
        )

        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        latest_version = supplement_data[self.question_xpath][self.action_id][
            '_versions'
        ][0]
        self.assertTrue(latest_version.get('_dateAccepted'))
        self.assertNotIn('auto_accept', latest_version['_data'])

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


class RunningTranscriptionTestCase(BaseTestCase):
    """
    A transcription whose run is `in_progress`, as its poll finds it
    """

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

    def _versions(self, action_id=None, language=None) -> list[dict]:
        content = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        ).content
        action_data = content[self.question_xpath][action_id or self.action_id]
        return (action_data[language] if language else action_data)['_versions']

    def _land_result(self):
        """
        Save a `complete` version on top of the running one, as the poll that
        finishes a run does
        """
        with patch(
            'kobo.apps.subsequences.actions.base.BaseAutomaticNLPAction.run_external_process'  # noqa: E501
        ) as mock_run:
            mock_run.return_value = {
                'status': 'complete',
                'value': 'Hello',
                'language': 'en',
            }
            SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    self.question_xpath: {self.action_id: {'language': 'en'}},
                },
            )

    def _start_later_run(self) -> str:
        """
        Put a later run on top, `in_progress` too, as a relaunch after a
        delete does, and return its `_uuid`
        """
        supplement = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        )
        versions = supplement.content[self.question_xpath][self.action_id]['_versions']
        later_run = {**versions[0], '_uuid': str(uuid.uuid4())}
        versions.insert(0, later_run)
        supplement.save(update_fields=['content'])
        return later_run['_uuid']


class TestPollRunExternalProcessFailure(RunningTranscriptionTestCase):

    CHUNKED_RUN = 'kobo.apps.subsequences.models.ChunkedTranscriptionRun'

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

    def test_failure_handler_strips_auto_accept(self):
        """
        Test that the failure handler writes the failed version while dropping
        the request-only auto_accept key the result schema would otherwise reject
        """
        self.task_kwargs['kwargs']['action_data'] = {
            'language': 'en',
            'auto_accept': True,
        }

        poll_run_external_process_failure(
            sender=None, exception=Exception('boom'), **self.task_kwargs
        )

        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        latest_version = supplement_data[self.question_xpath][self.action_id][
            '_versions'
        ][0]
        self.assertEqual(latest_version['_data']['status'], 'failed')
        self.assertNotIn('auto_accept', latest_version['_data'])

    def test_a_poll_that_crashes_ends_the_run_as_failed(self):
        """
        An unexpected error stops the polling for good: without a `failed`
        version the run would stay `in_progress` for ever
        """
        with patch(
            'kobo.apps.subsequences.actions.base.BaseAutomaticNLPAction.run_external_process',  # noqa: E501
            side_effect=RuntimeError('the database went away'),
        ):
            poll_run_external_process(
                **self.task_kwargs['kwargs'],
                version_uuid=self._versions()[0]['_uuid'],
            )

        latest_data = self._versions()[0]['_data']
        self.assertEqual(latest_data['status'], 'failed')
        self.assertEqual(latest_data['error'], 'the database went away')

    def test_a_result_that_landed_first_is_kept(self):
        self._land_result()
        versions = self._versions()

        poll_run_external_process_failure(
            sender=None, exception=Exception('boom'), **self.task_kwargs
        )

        self.assertEqual(versions[0]['_data']['status'], 'complete')
        self.assertEqual(self._versions(), versions)

    def test_a_result_landing_after_the_read_is_kept(self):
        """
        The status is checked again in the update itself, so a result saved
        between reading the supplement and writing the failure is kept
        """
        stale_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        self._land_result()

        with patch.object(
            SubmissionSupplement, 'retrieve_data', return_value=stale_data
        ):
            saved = SubmissionSupplement.fail_in_progress_action(
                self.asset,
                self.submission_uuid,
                self.question_xpath,
                self.action_id,
                {'language': 'en'},
                'boom',
                self._versions()[1]['_uuid'],
            )

        self.assertFalse(saved)
        self.assertEqual(self._versions()[0]['_data']['status'], 'complete')

    def test_a_poll_ends_its_own_run(self):
        own_run = self._versions()[0]['_uuid']

        poll_run_external_process_failure(
            sender=None,
            exception=Exception('boom'),
            kwargs={**self.task_kwargs['kwargs'], 'version_uuid': own_run},
        )

        self.assertEqual(self._versions()[0]['_data']['status'], 'failed')

    def test_an_old_poll_never_ends_a_later_run(self):
        """
        A poll left over from an earlier run, giving up after the user deleted
        that run and launched a new one, leaves the new run running, whether it
        crashes or runs out of retries
        """
        old_run = self._versions()[0]['_uuid']
        later_run = self._start_later_run()
        old_poll = {**self.task_kwargs['kwargs'], 'version_uuid': old_run}

        with self.subTest('crash'), patch(
            'kobo.apps.subsequences.actions.base.BaseAutomaticNLPAction.run_external_process',  # noqa: E501
            side_effect=RuntimeError('the database went away'),
        ):
            poll_run_external_process(**old_poll)

        with self.subTest('out of retries'):
            poll_run_external_process_failure(
                sender=None, exception=Exception('boom'), kwargs=old_poll
            )

        latest = self._versions()[0]
        self.assertEqual(latest['_uuid'], later_run)
        self.assertEqual(latest['_data']['status'], 'in_progress')

    def test_a_later_run_started_after_the_read_is_kept(self):
        """
        The run is checked again in the update itself, so a run launched
        between reading the supplement and writing the failure is kept
        """
        old_run = self._versions()[0]['_uuid']
        stale_data = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        later_run = self._start_later_run()

        with patch.object(
            SubmissionSupplement, 'retrieve_data', return_value=stale_data
        ):
            saved = SubmissionSupplement.fail_in_progress_action(
                self.asset,
                self.submission_uuid,
                self.question_xpath,
                self.action_id,
                {'language': 'en'},
                'boom',
                old_run,
            )

        self.assertFalse(saved)
        self.assertEqual(self._versions()[0]['_uuid'], later_run)

    def test_a_poll_giving_up_cancels_what_is_left_of_its_chunked_run(self):
        """
        Even a poll not told its run: the run it ended is the one cancelled
        """
        running = self._versions()[0]['_uuid']

        with patch(self.CHUNKED_RUN) as run_class:
            poll_run_external_process_failure(
                sender=None, exception=Exception('boom'), **self.task_kwargs
            )

        self.assertEqual(self._versions()[0]['_data']['status'], 'failed')
        run_class.assert_called_once_with(
            self.asset, self.submission_uuid, self.question_xpath, running
        )
        run_class.return_value.cancel.assert_called_once()
        # The engine, only built if a job needs stopping, is the action's
        (get_engine,) = run_class.return_value.cancel.call_args.args
        with patch.object(GoogleTranscriptionService, '__init__', return_value=None):
            self.assertIsInstance(get_engine(), GoogleTranscriptionService)

    def test_a_run_that_ended_first_keeps_its_chunks(self):
        self._land_result()

        with patch(self.CHUNKED_RUN) as run_class:
            poll_run_external_process_failure(
                sender=None, exception=Exception('boom'), **self.task_kwargs
            )

        run_class.assert_not_called()

    def test_a_translation_fails_only_in_its_own_language(self):
        """
        A translation keeps one block per language: the failure is written to
        the language that was running, and the others are left as they are
        """
        translation_id = Action.AUTOMATIC_GOOGLE_TRANSLATION
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            action=translation_id,
            question_xpath=self.question_xpath,
            params=[{'language': 'fr'}, {'language': 'es'}],
        )
        dependency = {
            '_actionId': self.action_id,
            '_uuid': '11111111-1111-1111-1111-111111111111',
        }

        def language_block(language, status):
            data = {'language': language, 'status': status}
            if status == 'complete':
                data['value'] = 'Hola'
            return {
                '_dateCreated': '2026-01-01T10:00:00Z',
                '_dateModified': '2026-01-01T10:00:00Z',
                '_versions': [
                    {
                        '_data': data,
                        '_dateCreated': '2026-01-01T10:00:00Z',
                        '_uuid': str(uuid.uuid4()),
                        '_dependency': dependency,
                    }
                ],
            }

        supplement = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        )
        spanish = language_block('es', 'complete')
        supplement.content[self.question_xpath][translation_id] = {
            'fr': language_block('fr', 'in_progress'),
            'es': spanish,
        }
        supplement.save(update_fields=['content'])

        poll_run_external_process_failure(
            sender=None,
            exception=Exception('boom'),
            kwargs={
                **self.task_kwargs['kwargs'],
                'action_id': translation_id,
                'action_data': {'language': 'fr'},
            },
        )

        french = self._versions(translation_id, 'fr')
        self.assertEqual(
            [version['_data']['status'] for version in french],
            ['failed', 'in_progress'],
        )
        self.assertEqual(french[0]['_dependency'], dependency)
        self.assertEqual(self._versions(translation_id, 'es'), spanish['_versions'])


class TestPollOfARunNoLongerInProgress(RunningTranscriptionTestCase):
    """
    A poll still going once its run is over (e.g. a second one, scheduled by
    the bulk watchdog) is never taken for a new launch: it only reports the
    run's result to the bulk item, or stops if a later run replaced it
    """

    RUN_EXTERNAL_PROCESS = (
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )

    def _poll(self, version_uuid: str, service_result: dict | None = None):
        """
        Run the bulk poll of `version_uuid`, and return the mocks of the
        service and of the mirroring to the bulk item
        """
        kwargs = self.task_kwargs['kwargs']
        with patch(
            self.RUN_EXTERNAL_PROCESS, return_value=service_result
        ) as run_service, patch(
            'kobo.apps.subsequences.tasks._update_bulk_action_item_status'
        ) as mirror_to_bulk_item:
            poll_run_external_process(
                **{
                    **kwargs,
                    'action_data': {
                        **kwargs['action_data'],
                        'bulk_action_uid': 'bulk-1',
                    },
                },
                version_uuid=version_uuid,
            )
        return run_service, mirror_to_bulk_item

    def _assert_poll_changes_nothing(self, version_uuid: str):
        """
        Poll `version_uuid`, check it neither called the service nor saved
        anything, and return the mock of the mirroring to the bulk item
        """
        versions = self._versions()

        run_service, mirror_to_bulk_item = self._poll(version_uuid)

        run_service.assert_not_called()
        self.assertEqual(self._versions(), versions)
        return mirror_to_bulk_item

    def _assert_poll_reports_result(self, version_uuid: str):
        mirror_to_bulk_item = self._assert_poll_changes_nothing(version_uuid)
        mirror_to_bulk_item.assert_called_once()
        self.assertEqual(mirror_to_bulk_item.call_args.kwargs['status'], 'complete')

    def _assert_poll_stops(self, version_uuid: str):
        self._assert_poll_changes_nothing(version_uuid).assert_not_called()

    def test_a_poll_on_an_ended_run_reports_it_without_launching_it_again(self):
        """
        E.g. the poll that ended the run was lost before reporting it
        """
        own_run = self._versions()[0]['_uuid']
        self._land_result()

        self._assert_poll_reports_result(own_run)

    def test_a_poll_told_the_result_of_its_run_reports_it(self):
        """
        As the poll resumed by the bulk watchdog once the result was saved is
        """
        self._land_result()

        self._assert_poll_reports_result(self._versions()[0]['_uuid'])

    def test_a_poll_leaves_a_later_run_to_its_own_poll(self):
        old_run = self._versions()[0]['_uuid']
        self._start_later_run()

        self._assert_poll_stops(old_run)

    def test_a_poll_never_reports_the_result_of_a_later_run(self):
        old_run = self._versions()[0]['_uuid']
        self._land_result()
        # Relaunched, and ended too
        self._land_result()

        self._assert_poll_stops(old_run)

    def test_a_poll_still_ends_its_running_run(self):
        """
        The result saved by the poll itself is a new version on top: the poll
        must still report it to the bulk item
        """
        own_run = self._versions()[0]['_uuid']

        run_service, mirror_to_bulk_item = self._poll(
            own_run, {'status': 'complete', 'value': 'Hello', 'language': 'en'}
        )

        run_service.assert_called_once()
        self.assertEqual(self._versions()[0]['_data']['status'], 'complete')
        self.assertEqual(mirror_to_bulk_item.call_args.kwargs['status'], 'complete')


class BulkTranscriptionTestCase(BaseTestCase):
    """
    A bulk transcription of two submissions, not started yet
    """

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


class TestSubsequenceBulkActionExecution(BulkTranscriptionTestCase):

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
    def test_start_bulk_item_job_auto_accepts_completed_result(
        self,
        mock_run_external_process,
    ):
        """
        Test that a completed result is stamped accepted when the parent bulk
        action enables auto_accept
        """
        mock_run_external_process.return_value = {
            'status': 'complete',
            'value': 'Done!',
            'language': 'en',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            auto_accept=True,
            status=BulkActionStatus.IN_PROGRESS,
        )

        start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.COMPLETE)
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset,
            submission_root_uuid=self.submission_uuid,
        )
        latest_version = supplement_data[self.question_xpath][self.action_id][
            '_versions'
        ][0]
        date_accepted = latest_version['_dateAccepted']
        self.assertIsInstance(date_accepted, str)
        self.assertTrue(date_accepted)
        self.assertNotIn('auto_accept', latest_version['_data'])

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_leaves_result_unaccepted_without_auto_accept(
        self,
        mock_run_external_process,
    ):
        """
        Test that a completed result is left unaccepted when the parent bulk
        action does not enable auto_accept
        """
        mock_run_external_process.return_value = {
            'status': 'complete',
            'value': 'Done!',
            'language': 'en',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])

        start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.COMPLETE)
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset,
            submission_root_uuid=self.submission_uuid,
        )
        latest_version = supplement_data[self.question_xpath][self.action_id][
            '_versions'
        ][0]
        self.assertNotIn('_dateAccepted', latest_version)

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_does_not_accept_in_progress_result(
        self,
        mock_run_external_process,
    ):
        """
        Test that an in-progress result is not accepted and that auto_accept is
        carried into the enqueued poll so completion can accept it later
        """
        mock_run_external_process.return_value = {
            'status': 'in_progress',
            'language': 'en',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            auto_accept=True,
            status=BulkActionStatus.IN_PROGRESS,
        )

        with patch(
            'kobo.apps.subsequences.tasks.poll_run_external_process.apply_async'
        ) as enqueue_poll:
            start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.IN_PROGRESS)
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset,
            submission_root_uuid=self.submission_uuid,
        )
        latest_version = supplement_data[self.question_xpath][self.action_id][
            '_versions'
        ][0]
        self.assertNotIn('_dateAccepted', latest_version)
        enqueue_poll.assert_called_once()
        poll_action_data = enqueue_poll.call_args.kwargs['kwargs']['action_data']
        self.assertIs(poll_action_data['auto_accept'], True)
        # Told the run it checks on: the version the launch left on top
        self.assertEqual(
            enqueue_poll.call_args.kwargs['kwargs']['version_uuid'],
            latest_version['_uuid'],
        )

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_does_not_accept_failed_result(
        self,
        mock_run_external_process,
    ):
        """
        Test that a failed result is not accepted even when auto_accept is enabled
        """
        mock_run_external_process.return_value = {
            'status': 'failed',
            'error': 'Transcription is not supported for language "en-US"',
            'language': 'en',
            'locale': 'en-US',
        }
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            auto_accept=True,
            status=BulkActionStatus.IN_PROGRESS,
        )

        start_bulk_item_job(item.pk)

        item.refresh_from_db()
        self.assertEqual(item.status, BulkActionItemStatus.FAILED)
        supplement_data = SubmissionSupplement.retrieve_data(
            self.asset,
            submission_root_uuid=self.submission_uuid,
        )
        latest_version = supplement_data[self.question_xpath][self.action_id][
            '_versions'
        ][0]
        self.assertNotIn('_dateAccepted', latest_version)

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_resume_polling_carries_auto_accept(
        self,
        mock_run_external_process,
    ):
        """
        Test that resuming polling for an existing Google operation carries the
        auto_accept flag into the enqueued poll
        """
        item = self.bulk_action.items.get(submission_root_uuid=self.submission_uuid)
        SubsequenceBulkAction.objects.filter(pk=self.bulk_action.pk).update(
            auto_accept=True,
            status=BulkActionStatus.IN_PROGRESS,
        )
        item.status = BulkActionItemStatus.IN_PROGRESS
        item.service_id = 'operations/google-op-1'
        item.save(update_fields=['status', 'service_id'])

        with patch(
            'kobo.apps.subsequences.tasks.poll_run_external_process.apply_async'
        ) as enqueue_poll:
            start_bulk_item_job(item.pk)

        mock_run_external_process.assert_not_called()
        enqueue_poll.assert_called_once()
        poll_action_data = enqueue_poll.call_args.kwargs['kwargs']['action_data']
        self.assertIs(poll_action_data['auto_accept'], True)

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
        # No version saved for it here: the poll still runs, not told its run
        self.assertIsNone(enqueue_poll.call_args.kwargs['kwargs']['version_uuid'])

    @patch(
        'kobo.apps.subsequences.actions.base.'
        'BaseAutomaticNLPAction.run_external_process'
    )
    def test_start_bulk_item_job_tells_a_resumed_poll_its_run(
        self,
        mock_run_external_process,
    ):
        """
        A poll resumed for a Google job already running checks on the run on
        top, so it can never end a later run
        """
        mock_run_external_process.return_value = {'status': 'in_progress'}
        SubmissionSupplement.revise_data(
            self.asset,
            {'meta/rootUuid': self.submission_uuid},
            {
                '_version': '20250820',
                self.question_xpath: {self.action_id: {'language': 'en'}},
            },
        )
        running_run = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )[self.question_xpath][self.action_id]['_versions'][0]['_uuid']

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

        enqueue_poll.assert_called_once()
        self.assertEqual(
            enqueue_poll.call_args.kwargs['kwargs']['version_uuid'], running_run
        )

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

        # The run the poll was scheduled for
        running_run = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )[self.question_xpath][self.action_id]['_versions'][0]['_uuid']

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
                    version_uuid=running_run,
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


@override_settings(GS_BUCKET_NAME='kobo-bucket')
class TestBulkTranscriptionOfALongRecording(BulkTranscriptionTestCase):
    """
    A recording too long for one request stays one bulk item, from its launch
    to its last chunk, through the real action, service and chunked run. Only
    Google, the audio itself and ffmpeg are replaced
    """

    GOOGLE_MODULE = 'kobo.apps.subsequences.integrations.google'
    SERVICE = f'{GOOGLE_MODULE}.google_transcribe.GoogleTranscriptionService'
    CHUNKS_MODULE = 'kobo.apps.subsequences.utils.chunked_transcription'
    # Two hours, cut once
    RANGES = (
        ChunkRange(index=0, start=0.0, end=3500.0),
        ChunkRange(index=1, start=3500.0, end=7200.0),
    )

    def setUp(self):
        super().setUp()
        self.bulk_action.status = BulkActionStatus.IN_PROGRESS
        self.bulk_action.save(update_fields=['status'])
        self.item = self.bulk_action.items.get(
            submission_root_uuid=self.submission_uuid
        )

        # Everything a bulk item does runs in a Celery worker
        worker = patch.object(
            type(celery_app),
            'current_worker_task',
            new_callable=PropertyMock,
            return_value=MagicMock(),
        )
        self.addCleanup(worker.stop)
        worker.start()

        # Google
        self._patch(
            f'{self.GOOGLE_MODULE}.base.google_credentials_from_constance_config'
        )
        self._patch(f'{self.GOOGLE_MODULE}.base.storage')
        self.check_usage = self._patch(
            f'{self.GOOGLE_MODULE}.base.raise_if_usage_limit_exceeded'
        )
        self._patch(
            f'{self.SERVICE}._get_google_language_config',
            return_value=SimpleNamespace(
                language_code='en-US', location_code='global', model_code=None
            ),
        )
        self._patch(
            f'{self.GOOGLE_MODULE}.google_transcribe.get_asr_language_code_overrides',
            return_value={},
        )
        self._patch(
            f'{self.GOOGLE_MODULE}.google_transcribe.require_google_service_quota'
        )
        self.submit = self._patch(
            f'{self.SERVICE}._batch_recognize',
            side_effect=lambda input_uri, output_prefix, config: SimpleNamespace(
                operation=SimpleNamespace(
                    name=f'operations/{self.submit.call_count}'
                )
            ),
        )
        self.job_done = False
        self._patch(
            f'{self.SERVICE}._get_operation_payload',
            side_effect=lambda name, location: {'done': self.job_done},
        )
        self._patch(
            f'{self.SERVICE}._read_batch_result',
            side_effect=lambda output_prefix: f'transcript of {output_prefix}',
        )
        self.cancel_job = self._patch(f'{self.SERVICE}.cancel_google_operation')
        self.charge = self._patch(f'{self.SERVICE}.update_counters')

        # The audio and ffmpeg
        self._patch(f'{self.SERVICE}._get_attachment', return_value=MagicMock(pk=7))
        self._patch(
            f'{self.GOOGLE_MODULE}.google_transcribe.get_audio_duration',
            return_value=self.RANGES[-1].end,
        )
        self.prepare = self._patch(
            f'{self.CHUNKS_MODULE}.convert_and_plan_chunks',
            side_effect=lambda attachment, source_path, hard_limit: (
                self._write_file(source_path) or list(self.RANGES)
            ),
        )
        self._patch(
            f'{self.CHUNKS_MODULE}.cut_audio',
            side_effect=lambda source, start, end, path, timeout: self._write_file(
                path
            ),
        )

    def _patch(self, target: str, **kwargs) -> MagicMock:
        patcher = patch(target, **kwargs)
        self.addCleanup(patcher.stop)
        return patcher.start()

    @staticmethod
    def _write_file(path: str) -> None:
        with open(path, 'wb') as file:
            file.write(b'flac')

    def _launch(self) -> dict:
        """
        Start the bulk item, and return the kwargs of the poll it schedules
        """
        with patch(
            'kobo.apps.subsequences.tasks.poll_run_external_process.apply_async'
        ) as schedule_poll:
            start_bulk_item_job(self.item.pk)
        schedule_poll.assert_called_once()
        return schedule_poll.call_args.kwargs['kwargs']

    def _poll(self, poll: dict) -> None:
        """
        Poll the run once, and check it is still going
        """
        with self.assertRaises(SubsequenceTimeoutError):
            poll_run_external_process(**poll)

    def _chunks(self) -> list[tuple]:
        return list(
            TranscriptionChunk.objects.order_by('index').values_list(
                'status', 'service_id'
            )
        )

    def _latest_version(self) -> dict:
        content = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        ).content
        return content[self.question_xpath][self.action_id]['_versions'][0]

    def _assert_item(self, status: str) -> None:
        items = self.bulk_action.items.filter(
            submission_root_uuid=self.submission_uuid
        )
        self.assertEqual(
            list(items.values_list('status', 'service_id')), [(status, '')]
        )

    def test_a_long_recording_is_transcribed_in_chunks_as_one_bulk_item(self):
        # The launch checks the usage limit and leaves the work to its poll
        poll = self._launch()
        run = self._latest_version()
        self.assertEqual(run['_data']['status'], 'in_progress')
        self.assertEqual(poll['version_uuid'], run['_uuid'])
        self.check_usage.assert_called_once()
        self.prepare.assert_not_called()
        self._assert_item(BulkActionItemStatus.IN_PROGRESS)

        # Its first poll prepares the chunks, without sending any
        self._poll(poll)
        self.assertEqual(self._chunks(), [('pending', None), ('pending', None)])
        self.submit.assert_not_called()

        # The next one sends the first chunk only
        self._poll(poll)
        self.assertEqual(
            self._chunks(), [('in_progress', 'operations/1'), ('pending', None)]
        )

        # Once Google is done with it, the second one goes
        self.job_done = True
        self._poll(poll)
        self.assertEqual(
            self._chunks(),
            [('complete', 'operations/1'), ('in_progress', 'operations/2')],
        )
        # Read from where its own attempt wrote
        self.assertEqual(
            TranscriptionChunk.objects.get(index=0).transcript,
            'transcript of '
            f'{constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX}/speech-v2/'
            f'chunks/{run["_uuid"]}/000/0',
        )

        # Both transcribed: what is left is the merge (DEV-2918)
        self._poll(poll)
        self.assertEqual(
            self._chunks(),
            [('complete', 'operations/1'), ('complete', 'operations/2')],
        )

        # One item all along, which never held a Google job of its own
        self._assert_item(BulkActionItemStatus.IN_PROGRESS)
        self.assertEqual(self._latest_version()['_uuid'], run['_uuid'])
        self.assertEqual(self.submit.call_count, 2)
        # Nothing charged yet, and no whole-file job to resume
        self.charge.assert_not_called()
        self.assertIsNone(
            cache.get(
                GoogleTranscriptionService._get_cache_key(
                    SimpleNamespace(
                        asset=self.asset, submission_root_uuid=self.submission_uuid
                    ),
                    self.question_xpath,
                    'en-US',
                    None,
                )
            )
        )
        # The other submission of the bulk action is left to its own job
        self.assertEqual(
            self.bulk_action.items.get(
                submission_root_uuid=self.second_submission_uuid
            ).status,
            BulkActionItemStatus.IN_PROGRESS,
        )

    def test_a_bulk_cancel_stops_the_running_chunk_and_sends_no_other(self):
        poll = self._launch()
        self._poll(poll)
        self._poll(poll)
        self.assertEqual(
            self._chunks(), [('in_progress', 'operations/1'), ('pending', None)]
        )

        self.bulk_action.cancel()

        # The next poll stops the job and ends the run, leaving the item as
        # the user cancelled it
        poll_run_external_process(**poll)
        self.cancel_job.assert_called_once_with('operations/1')
        self.assertEqual(
            self._chunks(), [('cancelled', 'operations/1'), ('cancelled', None)]
        )
        self.assertEqual(self.submit.call_count, 1)
        latest_data = self._latest_version()['_data']
        self.assertEqual(latest_data['status'], 'failed')
        self.assertEqual(latest_data['error'], 'Transcription cancelled')
        self._assert_item(BulkActionItemStatus.CANCELLED)
        self.charge.assert_not_called()

    def test_a_bulk_cancel_before_the_chunks_are_prepared_sends_none(self):
        """
        Preparing them takes minutes: a cancel landing in between must not
        get the recording transcribed anyway
        """
        poll = self._launch()

        self.bulk_action.cancel()
        poll_run_external_process(**poll)

        self.prepare.assert_not_called()
        self.submit.assert_not_called()
        self.assertEqual(self._latest_version()['_data']['status'], 'failed')
        self._assert_item(BulkActionItemStatus.CANCELLED)
