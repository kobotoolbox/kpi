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
3. Later polls find the rows and report on them.
"""

from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from tempfile import TemporaryDirectory

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import QuerySet

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.celery import celery_app
from kpi.exceptions import AudioDurationUnknownError, FFMpegException
from kpi.utils.audio_chunking import ChunkRange, convert_and_plan_chunks
from kpi.utils.ffmpeg import cut_audio
from kpi.utils.log import logging
from ..constants import UNIQUE_TRANSCRIPTION_CHUNK_PER_VERSION
from ..exceptions import ChunkStorageError, ChunkStorageRefusedError


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

    def get_status(self) -> dict | None:
        """
        Return where this run stands, or `None` when it has no chunks yet
        """

        # A run without a version has no rows to look for: `start()` never
        # saves any for it
        if not self.version_uuid or not self._chunks().exists():
            return None
        # Sending the chunks (DEV-2917) and merging their transcripts
        # (DEV-2918) report from here
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
