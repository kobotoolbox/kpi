from unittest.mock import patch

from django.test import TestCase
from freezegun import freeze_time

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset
from ..actions import (
    AutomaticGoogleTranscriptionAction,
    AutomaticGoogleTranslationAction,
)
from ..constants import SUBMISSION_UUID_FIELD
from ..models import QuestionAdvancedFeature, SubmissionSupplement

ACTION_ID = 'automatic_google_transcription'
POLL_PATH = 'kobo.apps.subsequences.actions.base.poll_run_external_process.apply_async'


class MockNLPService:
    def __init__(self, submission, asset, *args, **kwargs):
        pass

    def process_data(self, *args, **kwargs):
        pass


class InProgressUpfrontTestCase(TestCase):
    """
    The `in_progress` version of an automatic transcription is saved before
    the external service is called, and refreshed while it runs
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username='alice', email='alice@example.com', password='password'
        )
        self.asset = Asset.objects.create(owner=self.owner, name='Upfront Asset')
        self.xpath = 'group_name/question_name'
        for action in (ACTION_ID, 'manual_transcription'):
            QuestionAdvancedFeature.objects.create(
                asset=self.asset,
                question_xpath=self.xpath,
                action=action,
                params=[{'language': 'en'}],
            )
        self.submission_uuid = '123e4567-e89b-12d3-a456-426614174000'
        self.submission = {
            SUBMISSION_UUID_FIELD: self.submission_uuid,
            self.xpath: 'audio.m4a',
        }

    def _revise(self, action_data: dict, action_id: str = ACTION_ID, **service):
        """
        Call `SubmissionSupplement.revise_data()` with a mocked service.
        `service` holds `return_value` or `side_effect` for `process_data()`
        """
        with patch.object(
            AutomaticGoogleTranscriptionAction,
            'get_nlp_service_class',
            return_value=MockNLPService,
        ), patch.object(MockNLPService, 'process_data', **service):
            return SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {'_version': '20250820', self.xpath: {action_id: action_data}},
            )

    def _stored(self, action_id: str = ACTION_ID) -> dict:
        content = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        ).content
        return content[self.xpath][action_id]

    def _statuses(self) -> list[str]:
        return [v['_data']['status'] for v in self._stored()['_versions']]

    def test_in_progress_version_is_saved_before_the_service_is_called(self):
        seen_by_service = []

        def process_data(*args, **kwargs):
            seen_by_service.extend(self._statuses())
            return {'status': 'complete', 'value': 'hello'}

        self._revise({'language': 'en'}, side_effect=process_data)

        assert seen_by_service == ['in_progress']

    def test_sync_result_ends_with_in_progress_then_complete(self):
        with freeze_time('2026-01-01 10:00:00'):
            self._revise(
                {'language': 'en'},
                return_value={'status': 'complete', 'value': 'hello'},
            )

        stored = self._stored()
        assert self._statuses() == ['complete', 'in_progress']
        assert stored['_versions'][0]['_data']['value'] == 'hello'
        assert 'auto_accept' not in stored['_versions'][1]['_data']

    def test_sync_failure_ends_with_in_progress_then_failed(self):
        self._revise(
            {'language': 'en'},
            return_value={'status': 'failed', 'error': 'boom'},
        )

        assert self._statuses() == ['failed', 'in_progress']

    def test_async_launch_schedules_the_poll_and_adds_one_version(self):
        with patch(POLL_PATH) as poll:
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        poll.assert_called_once()
        assert self._statuses() == ['in_progress']

    def test_get_returns_the_in_progress_version_of_a_new_supplement(self):
        with patch(POLL_PATH):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        # What `GET .../supplement/` returns: content without `_version` would
        # be read back as the legacy schema and lose the version
        retrieved = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        versions = retrieved[self.xpath][ACTION_ID]['_versions']
        assert [v['_data']['status'] for v in versions] == ['in_progress']

    def test_get_returns_the_in_progress_version_of_an_empty_supplement(self):
        SubmissionSupplement.objects.create(
            asset=self.asset, submission_uuid=self.submission_uuid, content={}
        )
        with patch(POLL_PATH):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        retrieved = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_uuid
        )
        versions = retrieved[self.xpath][ACTION_ID]['_versions']
        assert [v['_data']['status'] for v in versions] == ['in_progress']

    def test_poll_still_in_progress_bumps_date_modified_only(self):
        with freeze_time('2026-01-01 10:00:00'), patch(POLL_PATH):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})
        started = self._stored()['_versions'][0]['_dateCreated']

        with freeze_time('2026-01-01 10:05:00'), patch(POLL_PATH) as poll:
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        stored = self._stored()
        poll.assert_not_called()
        assert self._statuses() == ['in_progress']
        assert stored['_versions'][0]['_dateCreated'] == started
        assert stored['_dateModified'] == '2026-01-01T10:05:00Z'

        with freeze_time('2026-01-01 10:10:00'):
            self._revise(
                {'language': 'en'},
                return_value={'status': 'complete', 'value': 'hello'},
            )

        assert self._statuses() == ['complete', 'in_progress']
        assert self._stored()['_versions'][1]['_dateCreated'] == started

    def test_launch_still_running_returns_the_saved_date_modified(self):
        with freeze_time('2026-01-01 10:00:00') as clock, patch(POLL_PATH):

            def process_data(*args, **kwargs):
                clock.tick(30)  # conversion, upload and the wait on Google
                return {'status': 'in_progress'}

            returned = self._revise({'language': 'en'}, side_effect=process_data)

        stored = self._stored()
        assert stored['_dateModified'] == '2026-01-01T10:00:30Z'
        assert returned[self.xpath][ACTION_ID]['_dateModified'] == (
            stored['_dateModified']
        )

    def test_poll_still_running_returns_the_saved_date_modified(self):
        with freeze_time('2026-01-01 10:00:00'), patch(POLL_PATH):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        with freeze_time('2026-01-01 10:05:00'):
            returned = self._revise(
                {'language': 'en'}, return_value={'status': 'in_progress'}
            )

        assert returned[self.xpath][ACTION_ID]['_dateModified'] == (
            '2026-01-01T10:05:00Z'
        )

    def test_leading_underscore_key_is_rejected_before_the_upfront_write(self):
        # The request and result schemas already block it: bypass both to
        # exercise the backup check
        with patch.object(
            AutomaticGoogleTranscriptionAction, 'validate_data'
        ), patch.object(
            AutomaticGoogleTranscriptionAction, 'validate_result'
        ), self.assertRaisesRegex(Exception, 'leading underscore'):
            self._revise({'language': 'en', '_sneaky': True})

        content = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        ).content
        assert ACTION_ID not in content.get(self.xpath, {})

    def test_question_name_with_double_underscore_stays_one_key(self):
        # `__` is legal in a question name, and must not be read as a nested path
        self.xpath = 'group_name/audio__recording'
        QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            question_xpath=self.xpath,
            action=ACTION_ID,
            params=[{'language': 'en'}],
        )
        self.submission[self.xpath] = 'audio.m4a'

        with freeze_time('2026-01-01 10:00:00'), patch(POLL_PATH):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})
        with freeze_time('2026-01-01 10:05:00'):
            returned = self._revise(
                {'language': 'en'}, return_value={'status': 'in_progress'}
            )

        content = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        ).content
        assert set(content) == {'_version', self.xpath}
        stored = content[self.xpath][ACTION_ID]
        assert [v['_data']['status'] for v in stored['_versions']] == ['in_progress']
        assert stored['_dateModified'] == '2026-01-01T10:05:00Z'
        assert returned[self.xpath][ACTION_ID]['_dateModified'] == (
            '2026-01-01T10:05:00Z'
        )

    def test_poll_does_not_erase_an_edit_made_meanwhile(self):
        with patch(POLL_PATH):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        # Simulate a poll that read the supplement before the user's edit
        stale_content = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_uuid
        ).content
        SubmissionSupplement.revise_data(
            self.asset,
            self.submission,
            {
                '_version': '20250820',
                self.xpath: {
                    'manual_transcription': {'language': 'en', 'value': 'mine'}
                },
            },
        )
        with patch.object(
            SubmissionSupplement.objects,
            'get_or_create',
            return_value=(SubmissionSupplement(content=stale_content), False),
        ):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        manual = self._stored('manual_transcription')
        assert manual['_versions'][0]['_data']['value'] == 'mine'

    def test_date_modified_is_not_touched_once_a_result_landed(self):
        with freeze_time('2026-01-01 10:00:00'):
            self._revise(
                {'language': 'en'},
                return_value={'status': 'complete', 'value': 'hello'},
            )

        with freeze_time('2026-01-01 10:05:00'):
            SubmissionSupplement._touch_in_progress_action(
                self.asset, self.submission_uuid, [self.xpath, ACTION_ID]
            )

        assert self._stored()['_dateModified'] == '2026-01-01T10:00:00Z'

    def test_delete_and_accept_never_create_an_in_progress_version(self):
        self._revise(
            {'language': 'en'},
            return_value={'status': 'complete', 'value': 'hello'},
        )
        self._revise({'language': 'en', 'accepted': True})
        assert self._statuses() == ['complete', 'in_progress']

        self._revise({'language': 'en', 'value': None})
        assert self._statuses() == ['deleted', 'complete', 'in_progress']

    def test_relaunch_after_delete_creates_a_new_in_progress_version(self):
        self._revise(
            {'language': 'en'},
            return_value={'status': 'complete', 'value': 'hello'},
        )
        self._revise({'language': 'en', 'value': None})

        with patch(POLL_PATH):
            self._revise({'language': 'en'}, return_value={'status': 'in_progress'})

        assert self._statuses() == [
            'in_progress',
            'deleted',
            'complete',
            'in_progress',
        ]

    def test_unexpected_error_ends_as_failed(self):
        self._revise({'language': 'en'}, side_effect=RuntimeError('cache down'))

        stored = self._stored()
        assert self._statuses() == ['failed', 'in_progress']
        assert stored['_versions'][0]['_data']['error'] == 'cache down'

    def test_bulk_worker_does_not_schedule_its_own_poll(self):
        with patch(POLL_PATH) as poll, patch(
            'kobo.apps.subsequences.actions.base.celery_app'
        ) as celery_app:
            celery_app.current_worker_task = object()
            supplement = self._revise(
                {'language': 'en', 'bulk_action_uid': 'sbaFakeUid'},
                return_value={'status': 'in_progress'},
            )

        poll.assert_not_called()
        # The bulk worker reads the returned data to decide whether to poll
        versions = supplement[self.xpath][ACTION_ID]['_versions']
        assert versions[0]['_data']['status'] == 'in_progress'
        assert versions[0]['_data']['bulk_action_uid'] == 'sbaFakeUid'

    def test_translation_keeps_saving_after_the_service(self):
        action = AutomaticGoogleTranslationAction(
            self.xpath, params=[{'language': 'fr'}], asset=self.asset
        )

        assert not action.action_class_config.create_in_progress_upfront
        assert (
            action.build_in_progress_supplemental_data(
                self.submission, {}, {'language': 'fr'}
            )
            is None
        )
