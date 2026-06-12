import json
import subprocess
from typing import Optional

from kpi.utils.log import logging
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment


def get_audio_duration(attachment: Attachment) -> Optional[float]:
    """
    Return audio duration in seconds for the given attachment

    Uses the `audio_length` field when available. Otherwise, runs ffprobe
    against the file's local path (FileSystemStorage) or its presigned URL
    (S3 / Azure). On success the result is persisted back to the DB so
    subsequent calls are instant.

    Returns `None` when ffprobe cannot determine the duration (unsupported
    format, corrupt file, network error, etc.)
    """
    if attachment.audio_length is not None:
        return attachment.audio_length

    # `absolute_path` returns a filesystem path for local storage and a
    # presigned URL for S3 / Azure, ffprobe handles both transparently
    path_or_url = attachment.absolute_path
    duration = _run_ffprobe(path_or_url, attachment.media_file_basename)

    if duration is not None:
        attachment.audio_length = duration
        attachment.save(update_fields=['audio_length'])

    return duration


def _run_ffprobe(path_or_url: str, label: str = '') -> Optional[float]:
    """
    Invoke ffprobe and return the duration in seconds, or `None` on failure
    """
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'json',
                path_or_url,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        data = json.loads(result.stdout)
        return float(data['format']['duration'])
    except subprocess.TimeoutExpired:
        logging.info('ffprobe timed out for %s', label or path_or_url)
        return None
    except Exception as exc:
        logging.info('ffprobe failed for %s: %s', label or path_or_url, exc)
        return None
