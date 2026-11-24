"""
Transcription of a recording too long for its engine, in chunks

Nothing here depends on the engine: Google STT v2 or any other service plugs in
through `ChunkedTranscriptionEngine`.

The work is split by where it runs:

1. The launch (web request or bulk start) only learns that the recording is
   too long, and replies `in_progress`. The poll it schedules does the rest.
2. The first poll prepares the chunks, in one pass: the recording is
   downloaded and converted once, its pauses decide where it is cut, each
   chunk is cut and uploaded, then the chunk rows are saved.
3. Later polls find the rows and move the run forward: the chunks are sent to
   the engine one after another, each once the one before is transcribed.
"""

from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from tempfile import TemporaryDirectory
from typing import Any

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, QuerySet
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.celery import celery_app
from kpi.exceptions import AudioDurationUnknownError, FFMpegException
from kpi.utils.audio_chunking import ChunkRange, convert_and_plan_chunks
from kpi.utils.ffmpeg import cut_audio
from kpi.utils.log import logging
from ..constants import (
    UNIQUE_TRANSCRIPTION_CHUNK_PER_VERSION,
    TranscriptionChunkStatus,
)
from ..exceptions import ChunkStorageError, ChunkStorageRefusedError

TIMED_OUT_ERROR = (
    'Transcription failed: part of the audio took too long to be transcribed'
)
CANCELLED_ERROR = 'Transcription cancelled'


@dataclass(frozen=True)
class JobReport:
    """
    What a transcription engine reports on one of its jobs

    `status` is `in_progress`, `complete` with `transcript`, or `failed` with
    `error`, a message for the user. `service_id` is the engine's own name
    for a job it was sent, enough to check on it and to cancel it.
    `retryable` tells whether the job may succeed if started again: not when
    e.g. the engine's credentials are refused
    """

    status: str
    service_id: str | None = None
    transcript: str | None = None
    error: str | None = None
    retryable: bool = True


class ChunkedTranscriptionEngine(ABC):
    """
    A transcription service that can be sent a long recording in chunks
    """

    @property
    @abstractmethod
    def CHUNK_HARD_LIMIT_SECONDS(self) -> float:  # noqa: N802
        """
        Longest chunk, in seconds, the engine accepts in one request. Each
        engine sets it as a class attribute, which overrides this property
        """

    @abstractmethod
    def store_chunk_file(self, local_path: str, version_uuid: str, index: int) -> str:
        """
        Upload the chunk file at `local_path` to where the engine reads it,
        and return that location

        The location depends only on `version_uuid` and `index`, so preparing
        the same run again replaces its files instead of leaving copies.
        Raise `ChunkStorageError` when storage cannot be reached, and the
        chunks are prepared again on the next poll. Raise
        `ChunkStorageRefusedError` when storage refuses the file, and the run
        fails: preparing it again would be refused the same way
        """

    @abstractmethod
    def start_chunk(self, chunk, config: Any) -> JobReport:
        """
        Send the file of `chunk` to be transcribed, as `config`, the engine's
        own settings for the run, says

        Report `in_progress` with the job's `service_id` once sent, or
        `complete` when the engine transcribes it at once. `in_progress`
        without a `service_id` means it could not be sent, for a reason that
        may pass: it is sent again on the next poll, as the same attempt.
        Each attempt (`chunk.retry_count`) keeps its results apart from the
        others', so a late one is never read as another's. A quota error is
        raised, as for any other job, and the poll is retried later
        """

    @abstractmethod
    def check_chunk(self, chunk) -> JobReport:
        """
        Report on the job `chunk.service_id`, with its transcript once
        complete. A quota error is raised, as in `start_chunk()`
        """

    @abstractmethod
    def cancel_chunk(self, service_id: str) -> None:
        """
        Ask the engine to stop the job `service_id`, as far as it can

        Nothing depends on it, as the results of a job given up on are never
        read: it only saves the cost of the rest of the job
        """


@dataclass(frozen=True)
class ChunkedTranscriptionRun:
    """
    One run of a chunked transcription, the run being the `in_progress`
    version identified by `version_uuid`

    Rows are matched on that version, not only on the submission and
    question: they are kept after the merge, so a run launched after a delete
    must not take the previous run's rows for its own.
    """

    asset: 'kpi.models.Asset'
    submission_uuid: str
    question_xpath: str
    version_uuid: str | None

    def get_status(
        self, engine: ChunkedTranscriptionEngine, config: Any
    ) -> dict | None:
        """
        Return where this run stands, or `None` when it has no chunks yet

        Called by the poll, in a Celery worker, it also moves the run forward:
        the chunks are sent in order, each once the one before is
        transcribed, and a chunk that fails is sent again on its own, up to
        `TRANSCRIPTION_CHUNK_MAX_RETRIES` times. `config` is passed on to
        `engine.start_chunk()`
        """
        if not celery_app.current_worker_task:
            # Only the poll moves the run forward or ends it. A repeated web
            # request doing so too would race it for the same chunks
            return {'status': 'in_progress'} if self._chunks().exists() else None

        chunks = list(self._chunks().defer('transcript'))
        if not chunks:
            return None

        # Ended, but polled again (e.g. by a second poll). A failure is
        # looked for first: it cancels the chunks after it, and its error is
        # the one worth showing
        if failed := next(
            (
                chunk
                for chunk in chunks
                if chunk.status == TranscriptionChunkStatus.FAILED
            ),
            None,
        ):
            return _failed(failed.failure_error)
        if any(chunk.status == TranscriptionChunkStatus.CANCELLED for chunk in chunks):
            return _failed(CANCELLED_ERROR)

        for chunk in chunks:
            if chunk.status == TranscriptionChunkStatus.COMPLETE:
                continue
            if chunk.status == TranscriptionChunkStatus.IN_PROGRESS:
                status = self._check(engine, chunk)
            else:
                status = self._send(engine, chunk, config)
            # `None` only when this chunk was just transcribed: go on to the
            # next one in the same poll
            if status is not None:
                return status

        # Every chunk is transcribed: merging them (DEV-2918) ends the run here
        return {'status': 'in_progress'}

    def start(
        self,
        engine: ChunkedTranscriptionEngine,
        attachment: Attachment,
        *,
        is_launch: bool,
    ) -> dict:
        """
        Prepare the chunks of this run, unless this call is not the place to

        Never charges usage and never calls the transcription service: usage
        is charged once every chunk is transcribed.
        """
        if not self.version_uuid:
            # Rows saved without it could never be found again
            logging.error(
                'Cannot start a chunked transcription without a version: '
                f'{self.submission_uuid=}, {self.question_xpath=}'
            )
            return {'status': 'failed', 'error': 'Transcription could not be started'}

        if is_launch or not celery_app.current_worker_task:
            # Converting a long recording takes minutes: the launch replies at
            # once and the poll it scheduled does the work, in a Celery worker.
            # A repeated web request finds the same poll already scheduled
            return {'status': 'in_progress'}

        try:
            chunks = self._prepare_chunks(engine, attachment)
        except (AudioDurationUnknownError, FFMpegException):
            logging.exception(
                f'Could not prepare transcription chunks for attachment '
                f'{attachment.pk}'
            )
            return {
                'status': 'failed',
                'error': 'Transcription failed: the audio file could not be processed',
            }
        except ChunkStorageError:
            logging.exception(
                f'Could not store transcription chunks for attachment '
                f'{attachment.pk}, they are prepared again on the next poll'
            )
            return {'status': 'in_progress'}
        except ChunkStorageRefusedError:
            # Logged in full, but kept out of the version: the storage error
            # names the bucket and the account it was refused to
            logging.exception(
                f'Storage refused the transcription chunks for attachment '
                f'{attachment.pk}'
            )
            return {
                'status': 'failed',
                'error': 'Transcription failed: the audio file could not be stored',
            }

        self._save_chunks(chunks)
        return {'status': 'in_progress'}

    def cancel(self, get_engine: Callable[[], ChunkedTranscriptionEngine]) -> None:
        """
        Cancel what is left of this run: chunks not transcribed yet are never
        sent, and the jobs of those being transcribed are stopped

        `get_engine` is only called when there is a job to stop, so cancelling
        a run that has none (e.g. its chunks are not prepared yet) never
        connects to the engine. Never raises because of the engine: the run
        is cancelled either way, the jobs only cost more if left running

        The rows are locked while they are marked: a poll sending one of them
        at that moment waits, then finds it cancelled and stops the job it
        has just started
        """
        now = timezone.now()
        with transaction.atomic():
            running = list(
                self._chunks()
                .select_for_update()
                .filter(
                    status__in=[
                        TranscriptionChunkStatus.PENDING,
                        TranscriptionChunkStatus.IN_PROGRESS,
                    ]
                )
                .values_list('pk', 'service_id')
            )
            if not running:
                return
            self._chunks().filter(pk__in=[pk for pk, _ in running]).update(
                status=TranscriptionChunkStatus.CANCELLED,
                ended_at=now,
                date_modified=now,
            )

        # Once the rows are committed, so no lock is held while the engine is
        # called
        if not (service_ids := [service_id for _, service_id in running if service_id]):
            return
        try:
            engine = get_engine()
        except Exception:
            logging.exception(
                f'Could not cancel the transcription jobs {service_ids} of '
                f'version {self.version_uuid}'
            )
            return
        for service_id in service_ids:
            self._cancel_job(engine, service_id)

    def _send(
        self,
        engine: ChunkedTranscriptionEngine,
        chunk,
        config: Any,
    ) -> dict | None:
        """
        Send `chunk` to the engine, and save that it was

        Returns `None` only if the engine transcribed it at once
        """
        report = engine.start_chunk(chunk, config)

        if report.status == TranscriptionChunkStatus.COMPLETE:
            return self._complete(chunk, report.transcript, started_at=timezone.now())
        if report.status == TranscriptionChunkStatus.FAILED:
            return self._retry_or_fail(
                engine, chunk, report.error, retryable=report.retryable
            )
        if not report.service_id:
            logging.info(
                f'Transcription chunk {chunk.index} of version '
                f'{self.version_uuid} could not be sent, it is sent again on '
                'the next poll'
            )
            return {'status': 'in_progress'}

        if not self._transition(
            chunk,
            status=TranscriptionChunkStatus.IN_PROGRESS,
            service_id=report.service_id,
            started_at=timezone.now(),
        ):
            # Another poll sent this chunk first: the job just started is one
            # too many
            self._cancel_job(engine, report.service_id)
        return {'status': 'in_progress'}

    def _check(self, engine: ChunkedTranscriptionEngine, chunk) -> dict | None:
        """
        Ask the engine about the job of `chunk`, sent earlier, and save what
        became of it

        Returns `None` only if the chunk is now transcribed. A job that is not
        done by `TRANSCRIPTION_CHUNK_TIMEOUT` is given up on. The engine is
        asked first, so a late poll never gives up on a job that has finished
        """
        report = engine.check_chunk(chunk)

        if report.status == TranscriptionChunkStatus.COMPLETE:
            return self._complete(chunk, report.transcript)
        if report.status == TranscriptionChunkStatus.FAILED:
            return self._retry_or_fail(
                engine, chunk, report.error, retryable=report.retryable
            )

        timeout = timedelta(seconds=settings.TRANSCRIPTION_CHUNK_TIMEOUT)
        if timezone.now() < chunk.started_at + timeout:
            return {'status': 'in_progress'}
        return self._retry_or_fail(engine, chunk, TIMED_OUT_ERROR, stop_job=True)

    def _complete(self, chunk, transcript: str, **changes) -> dict | None:
        """
        Save the transcript of `chunk`, and return `None` to go on to the next
        chunk, unless another poll moved this one on meanwhile
        """
        if self._transition(
            chunk,
            status=TranscriptionChunkStatus.COMPLETE,
            transcript=transcript,
            ended_at=timezone.now(),
            **changes,
        ):
            return None
        # Where it stands is unknown here: the next poll reads it again,
        # before anything is sent after it
        return {'status': 'in_progress'}

    def _retry_or_fail(
        self,
        engine: ChunkedTranscriptionEngine,
        chunk,
        error: str,
        *,
        retryable: bool = True,
        stop_job: bool = False,
    ) -> dict:
        """
        Put `chunk` back to be sent again on the next poll, as a new attempt,
        or fail the run once it is not worth it or `chunk` ran out of retries

        `stop_job` cancels the job of `chunk`, given up on while still running
        """
        retry = (
            retryable and chunk.retry_count < settings.TRANSCRIPTION_CHUNK_MAX_RETRIES
        )
        if retry:
            changes = {
                'status': TranscriptionChunkStatus.PENDING,
                'retry_count': F('retry_count') + 1,
                'service_id': None,
            }
        else:
            changes = {
                'status': TranscriptionChunkStatus.FAILED,
                'ended_at': timezone.now(),
            }
        if not self._transition(chunk, failure_error=error, **changes):
            # Another poll moved the chunk on meanwhile, and decides instead
            return {'status': 'in_progress'}

        if stop_job:
            self._cancel_job(engine, chunk.service_id)
        logging.warning(
            f'Transcription chunk {chunk.index} of version {self.version_uuid} '
            f'failed at attempt {chunk.retry_count + 1}, '
            f'{"sent again" if retry else "the run fails"}: {error}'
        )
        if retry:
            return {'status': 'in_progress'}

        # The chunks after it are never sent
        self.cancel(lambda: engine)
        return _failed(error)

    def _transition(self, chunk, **changes) -> bool:
        """
        Save `changes` to the row of `chunk`, only while it is still the same
        attempt in the same state as when it was read, and tell whether it was

        Another poll of the same run (e.g. a second one, scheduled by the bulk
        watchdog) may have moved it on meanwhile. Its view is then the right
        one, and this one must not overwrite it
        """
        return bool(
            self._chunks()
            .filter(
                pk=chunk.pk,
                status=chunk.status,
                retry_count=chunk.retry_count,
                service_id=chunk.service_id,
            )
            .update(date_modified=timezone.now(), **changes)
        )

    def _cancel_job(self, engine: ChunkedTranscriptionEngine, service_id: str) -> None:
        """
        Stop the job `service_id` if the engine can, without ever failing: its
        results are not read anyway
        """
        try:
            engine.cancel_chunk(service_id)
        except Exception:
            logging.exception(
                f'Could not cancel transcription job {service_id} of version '
                f'{self.version_uuid}'
            )

    def _chunks(self) -> QuerySet:
        # Imported here: the models module imports the actions, which import
        # the services that import this module
        from ..models import TranscriptionChunk

        return TranscriptionChunk.objects.filter(
            version_uuid=self.version_uuid,
            asset=self.asset,
            submission_uuid=self.submission_uuid,
            question_xpath=self.question_xpath,
        )

    def _prepare_chunks(
        self, engine: ChunkedTranscriptionEngine, attachment: Attachment
    ) -> list[tuple[ChunkRange, str]]:
        """
        Convert the recording, plan its cuts, then cut and upload each chunk

        Returns each chunk's range with where it was uploaded. The local files
        live in a temporary directory removed on the way out, whatever happens.
        Each chunk is deleted once uploaded, so that at most one sits next to
        the converted recording at any time.
        """
        timeout = settings.TRANSCRIPTION_SILENCE_DETECT_TIMEOUT
        started = time.monotonic()
        with TemporaryDirectory() as work_dir:
            source_path = os.path.join(work_dir, 'source.flac')
            ranges = convert_and_plan_chunks(
                attachment, source_path, engine.CHUNK_HARD_LIMIT_SECONDS
            )
            planned = time.monotonic()

            chunks = []
            for chunk in ranges:
                chunk_path = os.path.join(work_dir, f'chunk_{chunk.index:03d}.flac')
                cut_audio(source_path, chunk.start, chunk.end, chunk_path, timeout)
                chunks.append(
                    (
                        chunk,
                        engine.store_chunk_file(
                            chunk_path, self.version_uuid, chunk.index
                        ),
                    )
                )
                os.remove(chunk_path)
        finished = time.monotonic()

        # Kept in the logs so the stages can be timed when the estimate is
        # improved
        logging.info(
            'Prepared %d transcription chunk(s) for attachment %s in %.1fs: '
            'converted and planned in %.1fs, cut and uploaded in %.1fs',
            len(chunks),
            attachment.pk,
            finished - started,
            planned - started,
            finished - planned,
        )
        return chunks

    def _save_chunks(self, chunks: list[tuple[ChunkRange, str]]) -> None:
        """
        Save one `pending` row per chunk, all in one statement

        The rows are saved last, once every file is uploaded: a run that fails
        part-way leaves no rows, and the next poll prepares it again. If
        another worker saved this run's rows first, they are kept as they are
        """
        from ..models import TranscriptionChunk

        rows = [
            TranscriptionChunk(
                asset=self.asset,
                submission_uuid=self.submission_uuid,
                question_xpath=self.question_xpath,
                version_uuid=self.version_uuid,
                index=chunk.index,
                start_offset=chunk.start,
                end_offset=chunk.end,
                file_path=file_path,
            )
            for chunk, file_path in chunks
        ]
        try:
            # Its own savepoint, so a lost race never breaks a surrounding
            # transaction
            with transaction.atomic():
                TranscriptionChunk.objects.bulk_create(rows)
        except IntegrityError as err:
            diagnostic = getattr(err.__cause__, 'diag', None)
            if (
                getattr(diagnostic, 'constraint_name', None)
                != UNIQUE_TRANSCRIPTION_CHUNK_PER_VERSION
            ):
                raise
            logging.info(
                f'Transcription chunks of version {self.version_uuid} were '
                'saved by another worker first'
            )


def _failed(error: str) -> dict:
    """
    Return the result of a run that failed, `error` being the message for the
    user, as saved on its chunk
    """
    return {'status': 'failed', 'error': error}
