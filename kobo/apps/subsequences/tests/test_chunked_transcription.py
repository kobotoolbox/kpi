import os
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone

from kpi.exceptions import AudioDurationUnknownError, FFMpegException
from kpi.models import Asset
from kpi.utils.audio_chunking import ChunkRange
from ..constants import TranscriptionChunkStatus
from ..exceptions import (
    ChunkStorageError,
    ChunkStorageRefusedError,
    GoogleQuotaExceededError,
)
from ..integrations.google.google_transcribe import GoogleTranscriptionService
from ..models import TranscriptionChunk
from ..utils.chunked_transcription import (
    CANCELLED_ERROR,
    TIMED_OUT_ERROR,
    ChunkedTranscriptionEngine,
    ChunkedTranscriptionRun,
    JobReport,
)

MODULE = 'kobo.apps.subsequences.utils.chunked_transcription'
SERVICE_MODULE = 'kobo.apps.subsequences.integrations.google.google_transcribe'

# A 110 min recording, cut at 52:10 and 104:30
RANGES = [
    ChunkRange(index=0, start=0.0, end=3130.0),
    ChunkRange(index=1, start=3130.0, end=6270.0),
    ChunkRange(index=2, start=6270.0, end=6600.0),
]


def _write_file(path: str) -> None:
    with open(path, 'wb') as file:
        file.write(b'flac')


# The engine's own settings for a run, passed through as they are
CONFIG = object()

IN_PROGRESS = {'status': 'in_progress'}


class FakeEngine(ChunkedTranscriptionEngine):
    """
    Records what it is asked to store, send, check and cancel.
    `failing_index` makes storing that chunk raise `error`: by default the way
    unreachable storage would

    A chunk is sent as the job `job-<index>.<attempt>` and stays in progress,
    unless a test sets `on_start` or `on_check` to report otherwise
    """

    CHUNK_HARD_LIMIT_SECONDS = 55 * 60

    def __init__(
        self,
        failing_index: int | None = None,
        error: type[Exception] = ChunkStorageError,
    ):
        self.failing_index = failing_index
        self.error = error
        self.stored = []
        self.started = []
        self.checked = []
        self.cancelled = []
        self.on_start = lambda chunk: JobReport(
            'in_progress', service_id=f'job-{chunk.index}.{chunk.retry_count}'
        )
        self.on_check = lambda chunk: JobReport('in_progress')

    def start_chunk(self, chunk, config):
        assert config is CONFIG
        self.started.append(f'{chunk.index}.{chunk.retry_count}')
        return self.on_start(chunk)

    def check_chunk(self, chunk):
        self.checked.append(chunk.service_id)
        return self.on_check(chunk)

    def cancel_chunk(self, service_id):
        self.cancelled.append(service_id)

    def store_chunk_file(self, local_path: str, version_uuid: str, index: int) -> str:
        if index == self.failing_index:
            raise self.error('storage failed')
        # Uploaded while the file is still there
        assert os.path.exists(local_path)
        self.stored.append((os.path.basename(local_path), version_uuid, index))
        return f'gs://bucket/chunks/{version_uuid}/{index:03d}.flac'


class ChunkRowsTestCase(TestCase):
    """
    A chunked run, with helpers to write and read the rows of its chunks
    """

    fixtures = ['test_data']

    def setUp(self):
        self.asset = Asset.objects.get(pk=2)
        self.attachment = MagicMock(pk=7)
        self.run = self._get_run('version-1')

    def _get_run(self, version_uuid, question_xpath='audio'):
        return ChunkedTranscriptionRun(
            self.asset, 'submission-1', question_xpath, version_uuid
        )

    def _get_status(self, engine, *, in_worker=True):
        with patch(f'{MODULE}.celery_app') as celery_app:
            celery_app.current_worker_task = MagicMock() if in_worker else None
            return self.run.get_status(engine, CONFIG)

    def _statuses(self) -> list[str]:
        return list(
            TranscriptionChunk.objects.order_by('index').values_list(
                'status', flat=True
            )
        )

    def _create_chunk(self, version_uuid='version-1', index=0, **fields):
        return TranscriptionChunk.objects.create(
            asset=self.asset,
            submission_uuid='submission-1',
            question_xpath=fields.pop('question_xpath', 'audio'),
            version_uuid=version_uuid,
            index=index,
            start_offset=0.0,
            end_offset=60.0,
            **fields,
        )


@override_settings(TRANSCRIPTION_SILENCE_DETECT_TIMEOUT=300)
class ChunkedTranscriptionRunTestCase(ChunkRowsTestCase):

    def _start(self, engine=None, *, run=None, is_launch=False, in_worker=True):
        """
        Start `run` with the conversion, the planning and the cuts replaced:
        they write empty files where ffmpeg would write audio. Returns the
        result and the mocks
        """

        def convert(attachment, source_path, hard_limit):
            _write_file(source_path)
            return RANGES

        with patch(
            f'{MODULE}.convert_and_plan_chunks', side_effect=convert
        ) as convert_and_plan, patch(
            f'{MODULE}.cut_audio',
            side_effect=lambda source, start, end, path, timeout: _write_file(path),
        ) as cut_audio, patch(
            f'{MODULE}.celery_app'
        ) as celery_app:
            celery_app.current_worker_task = MagicMock() if in_worker else None
            result = (run or self.run).start(
                engine or FakeEngine(), self.attachment, is_launch=is_launch
            )

        return result, convert_and_plan, cut_audio

    def test_the_launch_leaves_the_work_to_its_poll(self):
        """
        A web launch or a bulk launch (already in a worker), and a repeated web
        request, all reply at once: the poll the launch scheduled does the work
        """

        for is_launch, in_worker in [(True, False), (True, True), (False, False)]:
            with self.subTest(is_launch=is_launch, in_worker=in_worker):
                result, convert_and_plan, _ = self._start(
                    is_launch=is_launch, in_worker=in_worker
                )

                assert result == {'status': 'in_progress'}
                convert_and_plan.assert_not_called()
                assert not TranscriptionChunk.objects.exists()

    def test_the_first_poll_prepares_and_saves_every_chunk(self):
        engine = FakeEngine()

        result, convert_and_plan, cut_audio = self._start(engine)

        assert result == {'status': 'in_progress'}
        _, source_path, hard_limit = convert_and_plan.call_args.args
        assert convert_and_plan.call_args.args[0] is self.attachment
        assert hard_limit == 55 * 60
        assert [call.args[1:3] for call in cut_audio.call_args_list] == [
            (chunk.start, chunk.end) for chunk in RANGES
        ]
        assert {call.args[4] for call in cut_audio.call_args_list} == {300}
        assert engine.stored == [
            ('chunk_000.flac', 'version-1', 0),
            ('chunk_001.flac', 'version-1', 1),
            ('chunk_002.flac', 'version-1', 2),
        ]
        assert list(
            TranscriptionChunk.objects.values_list(
                'version_uuid',
                'index',
                'start_offset',
                'end_offset',
                'status',
                'file_path',
            )
        ) == [
            (
                'version-1',
                chunk.index,
                chunk.start,
                chunk.end,
                TranscriptionChunkStatus.PENDING,
                f'gs://bucket/chunks/version-1/{chunk.index:03d}.flac',
            )
            for chunk in RANGES
        ]
        # The converted recording and its chunks are gone from the worker
        assert not os.path.exists(os.path.dirname(source_path))

    def test_rows_are_saved_only_once_every_chunk_is_uploaded(self):
        """
        A run that fails part-way leaves no rows, so the next poll prepares it
        again instead of taking it as started
        """

        result, convert_and_plan, _ = self._start(FakeEngine(failing_index=1))

        assert result == {'status': 'in_progress'}
        assert not TranscriptionChunk.objects.exists()
        source_path = convert_and_plan.call_args.args[1]
        assert not os.path.exists(os.path.dirname(source_path))

    def test_a_chunk_refused_by_storage_fails_the_run(self):
        """
        Preparing it again would be refused the same way. The storage error
        stays in the logs, out of the version the user sees
        """

        result, convert_and_plan, _ = self._start(
            FakeEngine(failing_index=1, error=ChunkStorageRefusedError)
        )

        assert result == {
            'status': 'failed',
            'error': 'Transcription failed: the audio file could not be stored',
        }
        assert not TranscriptionChunk.objects.exists()
        source_path = convert_and_plan.call_args.args[1]
        assert not os.path.exists(os.path.dirname(source_path))

    def test_audio_that_cannot_be_processed_fails_the_run(self):
        for error in (FFMpegException, AudioDurationUnknownError):
            with self.subTest(error=error.__name__), patch(
                f'{MODULE}.convert_and_plan_chunks', side_effect=error
            ), patch(f'{MODULE}.celery_app'):
                result = self.run.start(FakeEngine(), self.attachment, is_launch=False)

                assert result == {
                    'status': 'failed',
                    'error': (
                        'Transcription failed: the audio file could not be processed'
                    ),
                }
                assert not TranscriptionChunk.objects.exists()

    def test_rows_saved_first_by_another_worker_are_kept(self):
        """
        Two workers can prepare the same run. The second keeps what the first
        saved, and reports the run as running
        """

        first = self._create_chunk(file_path='gs://bucket/first.flac')

        result, _, _ = self._start()

        assert result == {'status': 'in_progress'}
        assert list(TranscriptionChunk.objects.values_list('pk', 'file_path')) == [
            (first.pk, 'gs://bucket/first.flac')
        ]

    def test_any_other_integrity_error_is_raised(self):
        with patch.object(
            TranscriptionChunk.objects,
            'bulk_create',
            side_effect=IntegrityError('null value in column "asset_id"'),
        ), pytest.raises(IntegrityError):
            self._start()

    def test_a_run_without_a_version_is_not_started(self):
        """
        Rows saved without a version could never be found again
        """

        result, convert_and_plan, _ = self._start(run=self._get_run(None))

        assert result == {
            'status': 'failed',
            'error': 'Transcription could not be started',
        }
        convert_and_plan.assert_not_called()

    def test_a_run_without_chunks_has_no_status(self):
        for in_worker in [True, False]:
            with self.subTest(in_worker=in_worker):
                assert self._get_status(FakeEngine(), in_worker=in_worker) is None

    def test_a_web_request_only_reports_on_the_chunks(self):
        self._create_chunk()
        engine = FakeEngine()

        assert self._get_status(engine, in_worker=False) == {'status': 'in_progress'}
        assert engine.started == []
        assert self._statuses() == ['pending']

    def test_rows_of_another_run_are_never_taken_for_this_one(self):
        """
        Rows are kept after the merge, so a run launched after a delete must
        not find the previous run's rows, nor those of another question
        """

        self._create_chunk(version_uuid='previous-version')
        self._create_chunk(question_xpath='other_question')

        assert self._get_status(FakeEngine()) is None


@override_settings(TRANSCRIPTION_CHUNK_MAX_RETRIES=2, TRANSCRIPTION_CHUNK_TIMEOUT=900)
class ChunkedTranscriptionProgressTestCase(ChunkRowsTestCase):
    """
    The polls that send the prepared chunks of `RANGES` and follow them
    """

    def setUp(self):
        super().setUp()
        self.engine = FakeEngine()
        self.send = self.engine.on_start
        for chunk in RANGES:
            self._create_chunk(
                index=chunk.index, file_path=f'gs://bucket/{chunk.index:03d}.flac'
            )

    def _poll(self) -> dict | None:
        return self._get_status(self.engine)

    def _row(self, index: int, *fields: str) -> tuple:
        return TranscriptionChunk.objects.values_list(*fields).get(index=index)

    def _set(self, index: int, **fields) -> None:
        TranscriptionChunk.objects.filter(index=index).update(**fields)

    def _set_running(self, index: int, *, attempt: int = 0, started_ago: int = 0):
        self._set(
            index,
            status='in_progress',
            service_id=f'job-{index}.{attempt}',
            retry_count=attempt,
            started_at=timezone.now() - timedelta(seconds=started_ago),
        )

    @staticmethod
    def _transcribed(chunk) -> JobReport:
        return JobReport('complete', transcript=f'part {chunk.index}')

    @staticmethod
    def _failing(chunk) -> JobReport:
        return JobReport('failed', error='Transcription failed with error boom')

    def test_chunks_are_sent_one_after_another(self):
        assert self._poll() == IN_PROGRESS
        assert self.engine.started == ['0.0']
        assert self._statuses() == ['in_progress', 'pending', 'pending']
        assert self._row(0, 'service_id') == ('job-0.0',)
        assert self._row(0, 'started_at')[0] is not None

        # Still running: checked, and nothing else is sent
        assert self._poll() == IN_PROGRESS
        assert self.engine.checked == ['job-0.0']
        assert self.engine.started == ['0.0']

        # Transcribed: saved, and the next one goes in the same poll
        self.engine.on_check = self._transcribed
        assert self._poll() == IN_PROGRESS
        assert self._row(0, 'status', 'transcript') == ('complete', 'part 0')
        assert self._row(0, 'ended_at')[0] is not None
        assert self.engine.started == ['0.0', '1.0']
        assert self._statuses() == ['complete', 'in_progress', 'pending']

    def test_an_engine_answering_at_once_transcribes_every_chunk_in_one_poll(self):
        self.engine.on_start = self._transcribed

        # Left to the merge
        assert self._poll() == IN_PROGRESS
        assert self.engine.started == ['0.0', '1.0', '2.0']
        assert self.engine.checked == []
        assert list(TranscriptionChunk.objects.values_list('status', 'transcript')) == [
            ('complete', f'part {chunk.index}') for chunk in RANGES
        ]
        assert not TranscriptionChunk.objects.filter(started_at__isnull=True).exists()

    def test_a_chunk_that_could_not_be_sent_is_sent_again_as_the_same_attempt(self):
        self.engine.on_start = lambda chunk: JobReport('in_progress')

        assert self._poll() == IN_PROGRESS
        assert self._row(0, 'status', 'retry_count') == ('pending', 0)

        self.engine.on_start = self.send
        assert self._poll() == IN_PROGRESS
        assert self.engine.started == ['0.0', '0.0']
        assert self._row(0, 'status', 'service_id') == ('in_progress', 'job-0.0')

    def test_a_quota_error_leaves_the_chunk_as_it_was(self):
        def out_of_quota(chunk):
            raise GoogleQuotaExceededError(retry_after=5)

        self.engine.on_start = out_of_quota

        with pytest.raises(GoogleQuotaExceededError):
            self._poll()
        assert self._statuses() == ['pending', 'pending', 'pending']

    def test_a_failed_chunk_is_sent_again_on_its_own(self):
        self._set(0, status='complete', transcript='part 0')
        self._set_running(1)
        self.engine.on_check = self._failing

        # Sent again by the next poll, as a new attempt
        assert self._poll() == IN_PROGRESS
        assert self._row(1, 'status', 'retry_count', 'service_id', 'failure_error') == (
            'pending',
            1,
            None,
            'Transcription failed with error boom',
        )
        assert self.engine.started == []

        assert self._poll() == IN_PROGRESS
        assert self.engine.started == ['1.1']
        assert self._statuses() == ['complete', 'in_progress', 'pending']

    def test_a_chunk_failing_every_attempt_fails_the_run(self):
        self._set_running(0, attempt=2)
        self.engine.on_check = self._failing
        failed = {'status': 'failed', 'error': 'Transcription failed with error boom'}

        assert self._poll() == failed
        assert self._statuses() == ['failed', 'cancelled', 'cancelled']

        # Polled again, e.g. by a second poll: still failed, nothing is sent
        self.engine.checked.clear()
        assert self._poll() == failed
        assert self.engine.started == []
        assert self.engine.checked == []

    def test_a_failure_not_worth_retrying_fails_the_run_at_once(self):
        self.engine.on_start = lambda chunk: JobReport(
            'failed', error='Transcription failed with error refused', retryable=False
        )

        assert self._poll() == {
            'status': 'failed',
            'error': 'Transcription failed with error refused',
        }
        assert self._row(0, 'retry_count') == (0,)
        assert self._statuses() == ['failed', 'cancelled', 'cancelled']

    def test_a_chunk_not_transcribed_in_time_is_given_up_on_and_sent_again(self):
        self._set_running(0, started_ago=901)

        assert self._poll() == IN_PROGRESS
        assert self.engine.cancelled == ['job-0.0']
        assert self._row(0, 'status', 'retry_count', 'service_id', 'failure_error') == (
            'pending',
            1,
            None,
            TIMED_OUT_ERROR,
        )

    def test_a_late_poll_keeps_a_chunk_transcribed_in_time(self):
        """
        The engine is asked before the time is checked: a poll held back (e.g.
        by a quota wait) never gives up on a job that has finished
        """
        self._set_running(0, started_ago=901)
        self.engine.on_check = self._transcribed

        assert self._poll() == IN_PROGRESS
        assert self._row(0, 'status', 'transcript') == ('complete', 'part 0')
        assert self.engine.cancelled == []

    def test_a_job_that_cannot_be_cancelled_is_still_given_up_on(self):
        self._set_running(0, started_ago=901)
        self.engine.cancel_chunk = MagicMock(side_effect=Exception('unreachable'))

        assert self._poll() == IN_PROGRESS
        assert self._row(0, 'status', 'retry_count') == ('pending', 1)

    def test_a_poll_beaten_to_a_chunk_cancels_the_job_it_started(self):
        def sent_by_another_poll_meanwhile(chunk):
            self._set_running(0)
            self._set(0, service_id='job-of-another-poll')
            return self.send(chunk)

        self.engine.on_start = sent_by_another_poll_meanwhile

        assert self._poll() == IN_PROGRESS
        assert self.engine.cancelled == ['job-0.0']
        assert self._row(0, 'service_id') == ('job-of-another-poll',)

    def test_a_poll_with_a_stale_view_saves_nothing_and_sends_nothing(self):
        """
        Here another poll gave up on the job and put the chunk back meanwhile:
        the result of the job given up on is not saved, and what comes after
        the chunk waits for the next poll to read it again
        """
        self._set_running(0)

        def given_up_on_by_another_poll_meanwhile(chunk):
            self._set(0, status='pending', retry_count=1, service_id=None)
            return self._transcribed(chunk)

        self.engine.on_check = given_up_on_by_another_poll_meanwhile

        assert self._poll() == IN_PROGRESS
        assert self._row(0, 'status', 'retry_count', 'transcript') == (
            'pending',
            1,
            None,
        )
        assert self.engine.started == []

    def test_cancelling_a_run_stops_its_running_job_and_sends_nothing_more(self):
        self._set(0, status='complete', transcript='part 0')
        self._set_running(1)
        get_engine = MagicMock(return_value=self.engine)

        self.run.cancel(get_engine)

        assert self._statuses() == ['complete', 'cancelled', 'cancelled']
        assert not TranscriptionChunk.objects.filter(
            status='cancelled', ended_at__isnull=True
        ).exists()
        assert self.engine.cancelled == ['job-1.0']

        # Polled again: failed, and nothing is sent
        assert self._poll() == {'status': 'failed', 'error': CANCELLED_ERROR}
        assert self.engine.started == []
        assert self.engine.checked == []

    def test_cancelling_a_run_without_a_running_job_never_reaches_the_engine(self):
        """
        Before its first chunk is sent, or before its chunks are even
        prepared (no rows yet)
        """
        get_engine = MagicMock()

        self.run.cancel(get_engine)
        assert self._statuses() == ['cancelled', 'cancelled', 'cancelled']

        self._get_run('version-without-rows').cancel(get_engine)
        get_engine.assert_not_called()

    def test_a_run_is_cancelled_even_if_the_engine_cannot_be_reached(self):
        self._set_running(0)

        self.run.cancel(MagicMock(side_effect=Exception('no credentials')))

        assert self._statuses() == ['cancelled', 'cancelled', 'cancelled']

    def test_a_poll_sending_a_chunk_as_the_run_is_cancelled_stops_its_job(self):
        def cancelled_meanwhile(chunk):
            self.run.cancel(lambda: self.engine)
            return self.send(chunk)

        self.engine.on_start = cancelled_meanwhile

        assert self._poll() == IN_PROGRESS
        assert self.engine.cancelled == ['job-0.0']
        assert self._statuses() == ['cancelled', 'cancelled', 'cancelled']


@override_settings(
    GS_BUCKET_NAME='kobo-bucket', TRANSCRIPTION_SILENCE_DETECT_TIMEOUT=300
)
class GoogleChunkedTranscriptionTestCase(TestCase):
    """
    The Google service and the chunked run together, from the launch to the
    polls that find the chunks prepared. Only ffmpeg, the attachment, the
    language settings and the bucket are replaced
    """

    fixtures = ['test_data']

    def setUp(self):
        service = object.__new__(GoogleTranscriptionService)
        service.asset = Asset.objects.get(pk=2)
        service.submission_root_uuid = 'submission-1'
        service.bucket = MagicMock()
        service._get_google_language_config = MagicMock(
            return_value=MagicMock(language_code='en-US', location_code='global')
        )
        service._get_operation_reference = MagicMock(return_value=None)
        service._get_attachment = MagicMock(return_value=MagicMock(pk=7))
        service._before_new_operation = MagicMock()
        service._start_operation = MagicMock()
        service._batch_recognize = MagicMock(
            return_value=MagicMock(operation=SimpleNamespace(name='operations/1'))
        )
        self.service = service

        def convert(attachment, source_path, hard_limit):
            _write_file(source_path)
            return RANGES

        self.mocks = SimpleNamespace(
            convert_and_plan=self._patch(
                f'{MODULE}.convert_and_plan_chunks', side_effect=convert
            ),
            cut_audio=self._patch(
                f'{MODULE}.cut_audio',
                side_effect=lambda source, start, end, path, timeout: _write_file(path),
            ),
            celery_app=self._patch(f'{MODULE}.celery_app'),
            get_audio_duration=self._patch(
                f'{SERVICE_MODULE}.get_audio_duration', return_value=RANGES[-1].end
            ),
        )
        self._patch(
            f'{SERVICE_MODULE}.get_asr_language_code_overrides', return_value={}
        )
        self._patch(
            f'{SERVICE_MODULE}.get_speech_location_for_model', return_value=None
        )
        self.mocks.require_quota = self._patch(
            f'{SERVICE_MODULE}.require_google_service_quota'
        )
        constance = self._patch(f'{SERVICE_MODULE}.constance')
        constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX = 'asr'

    def _patch(self, target: str, **kwargs) -> MagicMock:
        patcher = patch(target, **kwargs)
        self.addCleanup(patcher.stop)
        return patcher.start()

    def _process(self, *, is_launch: bool) -> dict:
        """
        Call the service the way the action does: the launch from a web
        request, each poll from a Celery worker
        """
        self.mocks.celery_app.current_worker_task = None if is_launch else MagicMock()
        return self.service.process_data(
            'audio', {'language': 'en'}, version_uuid='version-1', is_launch=is_launch
        )

    def test_a_long_recording_is_launched_then_prepared_then_sent(self):
        upload = self.service.bucket.blob.return_value.upload_from_filename
        chunk_paths = [
            f'asr/speech-v2/chunks/version-1/{chunk.index:03d}.flac' for chunk in RANGES
        ]

        # The launch checks the usage limit and replies at once
        assert self._process(is_launch=True) == {'status': 'in_progress'}
        self.service._before_new_operation.assert_called_once()
        self.mocks.convert_and_plan.assert_not_called()
        assert not TranscriptionChunk.objects.exists()

        # Its first poll prepares the chunks, without checking the limit again
        assert self._process(is_launch=False) == {'status': 'in_progress'}
        self.service._before_new_operation.assert_called_once()
        self.mocks.convert_and_plan.assert_called_once()
        assert [
            call.args[0] for call in self.service.bucket.blob.call_args_list
        ] == chunk_paths
        assert list(
            TranscriptionChunk.objects.order_by('index').values_list(
                'version_uuid', 'index', 'file_path'
            )
        ) == [
            ('version-1', chunk.index, f'gs://kobo-bucket/{path}')
            for chunk, path in zip(RANGES, chunk_paths)
        ]

        self.service._batch_recognize.assert_not_called()

        # The next poll finds the rows, and sends the first chunk only: no
        # attachment, no ffmpeg, no upload
        self.service._get_attachment.reset_mock()
        self.mocks.get_audio_duration.reset_mock()
        assert self._process(is_launch=False) == {'status': 'in_progress'}
        self.service._get_attachment.assert_not_called()
        self.mocks.get_audio_duration.assert_not_called()
        self.mocks.convert_and_plan.assert_called_once()
        assert upload.call_count == len(RANGES)
        self.service._start_operation.assert_not_called()
        self.mocks.require_quota.assert_called_once()
        self.service._batch_recognize.assert_called_once()
        file_path, output_prefix, config = self.service._batch_recognize.call_args.args
        assert file_path == f'gs://kobo-bucket/{chunk_paths[0]}'
        assert output_prefix == 'asr/speech-v2/chunks/version-1/000/0'
        assert config.language_code == 'en-US'
        assert list(
            TranscriptionChunk.objects.order_by('index').values_list(
                'status', 'service_id'
            )
        ) == [('in_progress', 'operations/1'), ('pending', None), ('pending', None)]


def test_an_engine_must_state_its_hard_limit():
    class EngineWithoutLimit(ChunkedTranscriptionEngine):
        def store_chunk_file(self, local_path, version_uuid, index):
            return ''

        def start_chunk(self, chunk, config):
            return JobReport('in_progress')

        def check_chunk(self, chunk):
            return JobReport('in_progress')

        def cancel_chunk(self, service_id):
            pass

    with pytest.raises(TypeError, match='CHUNK_HARD_LIMIT_SECONDS'):
        EngineWithoutLimit()
