import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.db import IntegrityError
from django.test import TestCase, override_settings

from kpi.exceptions import AudioDurationUnknownError, FFMpegException
from kpi.models import Asset
from kpi.utils.audio_chunking import ChunkRange
from ..exceptions import ChunkStorageError, ChunkStorageRefusedError
from ..integrations.google.google_transcribe import GoogleTranscriptionService
from ..models import TranscriptionChunk, TranscriptionChunkStatus
from ..utils.chunked_transcription import (
    ChunkedTranscriptionEngine,
    ChunkedTranscriptionRun,
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


class FakeEngine(ChunkedTranscriptionEngine):
    """
    Records what it is asked to store. `failing_index` makes storing that
    chunk raise `error`: by default the way unreachable storage would
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

    def store_chunk_file(self, local_path: str, version_uuid: str, index: int) -> str:
        if index == self.failing_index:
            raise self.error('storage failed')
        # Uploaded while the file is still there
        assert os.path.exists(local_path)
        self.stored.append((os.path.basename(local_path), version_uuid, index))
        return f'gs://bucket/chunks/{version_uuid}/{index:03d}.flac'


@override_settings(TRANSCRIPTION_SILENCE_DETECT_TIMEOUT=300)
class ChunkedTranscriptionRunTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.asset = Asset.objects.get(pk=2)
        self.attachment = MagicMock(pk=7)
        self.run = self._get_run('version-1')

    def _get_run(self, version_uuid, question_xpath='audio'):
        return ChunkedTranscriptionRun(
            self.asset, 'submission-1', question_xpath, version_uuid
        )

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
        assert self.run.get_status() is None

    def test_a_run_without_a_version_has_no_status_and_runs_no_query(self):
        with self.assertNumQueries(0):
            assert self._get_run(None).get_status() is None

    def test_a_run_with_chunks_is_in_progress(self):
        self._create_chunk()

        assert self.run.get_status() == {'status': 'in_progress'}

    def test_rows_of_another_run_are_never_taken_for_this_one(self):
        """
        Rows are kept after the merge, so a run launched after a delete must
        not find the previous run's rows, nor those of another question
        """

        self._create_chunk(version_uuid='previous-version')
        self._create_chunk(question_xpath='other_question')

        assert self.run.get_status() is None


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

    def test_a_long_recording_is_launched_then_prepared_then_reported_on(self):
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

        # Later polls find the rows: no attachment, no ffmpeg, no upload
        self.service._get_attachment.reset_mock()
        self.mocks.get_audio_duration.reset_mock()
        assert self._process(is_launch=False) == {'status': 'in_progress'}
        self.service._get_attachment.assert_not_called()
        self.mocks.get_audio_duration.assert_not_called()
        self.mocks.convert_and_plan.assert_called_once()
        assert upload.call_count == len(RANGES)
        self.service._start_operation.assert_not_called()


def test_an_engine_must_state_its_hard_limit():
    class EngineWithoutLimit(ChunkedTranscriptionEngine):
        def store_chunk_file(self, local_path, version_uuid, index):
            return ''

    with pytest.raises(TypeError, match='CHUNK_HARD_LIMIT_SECONDS'):
        EngineWithoutLimit()
