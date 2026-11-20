from typing import Optional

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kpi.utils.ffmpeg import probe_duration


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
    duration = probe_duration(path_or_url, attachment.media_file_basename)

    if duration is not None:
        attachment.audio_length = duration
        attachment.save(update_fields=['audio_length'])

    return duration
