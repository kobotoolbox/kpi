from __future__ import annotations

from django.conf import settings

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kpi.exceptions import (
    AttachmentNotFoundException,
    InvalidXPathException,
    NotSupportedFormatException,
    SubmissionNotFoundException,
    XPathNotFoundException,
)
from kpi.utils.log import logging

from ...constants import SUBMISSION_UUID_FIELD
from .client import LocalServiceError, must_defer_to_worker, transcribe


class LocalTranscriptionService:
    """
    Transcribe with the OpenAI-compatible speech-to-text server at
    `LOCAL_WHISPER_URL` (`NLP_BACKEND=local`). Same interface as
    `GoogleTranscriptionService`.

    Transcription only happens in a Celery worker (see `must_defer_to_worker()`):
    called from a request, `process_data()` returns `in_progress`, and
    `BaseAutomaticNLPAction.run_external_process()` schedules
    `poll_run_external_process`, which calls it again from the worker.
    """

    def __init__(self, submission: dict, asset: 'kpi.models.Asset', *args, **kwargs):
        self.submission = submission
        self.submission_root_uuid = remove_uuid_prefix(
            self.submission[SUBMISSION_UUID_FIELD]
        )
        self.asset = asset

    def process_data(
        self,
        xpath: str,
        params: dict,
        bulk_action_uid: str | None = None,
    ) -> dict:
        # Whisper takes plain language codes: 'es' for the 'es-MX' locale
        language = (params.get('locale') or params['language']).split('-')[0]

        if must_defer_to_worker():
            return {'status': 'in_progress'}

        try:
            attachment = self.asset.deployment.get_attachment(
                self.submission_root_uuid, self.asset.owner, xpath=xpath
            )
            audio = attachment.get_transcoded_audio('flac')
        except SubmissionNotFoundException:
            return {'status': 'failed', 'error': 'Submission not found'}
        except AttachmentNotFoundException:
            return {'status': 'failed', 'error': 'Attachment not found'}
        except (InvalidXPathException, XPathNotFoundException):
            return {'status': 'failed', 'error': 'Invalid question name XPath'}
        except NotSupportedFormatException:
            return {'status': 'failed', 'error': 'Unsupported format'}

        try:
            text = transcribe(
                audio,
                f'{self.submission_root_uuid}.flac',
                language,
                read_timeout=settings.LOCAL_LLM_TASK_READ_TIMEOUT,
            ).strip()
        except LocalServiceError as e:
            logging.warning(f'Local transcription failed for {xpath=}: {e}')
            return {'status': 'failed', 'error': f'Transcription failed: {e}'}

        if not text:
            return {
                'status': 'failed',
                'error': 'Transcription failed: no speech was recognized',
            }
        return {'status': 'complete', 'value': text}
