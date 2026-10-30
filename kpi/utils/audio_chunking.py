from dataclasses import dataclass
from math import isfinite

from django.conf import settings

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kpi.exceptions import AudioDurationUnknownError
from kpi.utils.audio_duration import get_audio_duration
from kpi.utils.ffmpeg import Silence, detect_silences
from kpi.utils.log import logging

# Think of this as asking: "Of the pauses we found, which do we cut at?"
# Every pause in reach of a cut is a candidate. We find the longest, then cut
# at the latest pause that is at least 70% as long. Long pauses are sentence
# or speaker breaks, and taking the latest one keeps chunks long, so there are
# fewer to transcribe.
#
# Why not simply the longest? In one real recording, a 0.92s pause came 3
# seconds after the previous cut and a 0.66s pause 4 minutes after it. "Longest
# wins" would cut at 3 seconds: a 3-second chunk that still costs a full
# request. At 0.7 the 0.66s pause qualifies (0.66 >= 0.7 * 0.92 = 0.644) and,
# being later, is chosen. On the sample recordings this removed five such tiny
# chunks and added none; at 0.8 the 0.66s pause would not qualify.
GOOD_ENOUGH_SILENCE_FRACTION = 0.7

# Shortest remainder worth sending as its own chunk. Without this a file only
# just over the limit ends in a stub: a 55:00.04 recording would be cut into
# 55:00 plus 0.04 seconds, a whole transcription request for audio the service
# may well refuse. When the tail would come out shorter than this, the window
# is pulled in so both pieces are worth sending.
MIN_LAST_CHUNK_SECONDS = 30.0


@dataclass(frozen=True)
class ChunkRange:
    """
    Where one chunk of a long audio file starts and ends

    Three numbers and nothing else: no audio is attached to it.
    """

    index: int  # 0, 1, 2... the order the transcripts are joined back in
    start: float  # seconds from the start of the original file
    end: float

    @property
    def duration(self) -> float:
        return self.end - self.start


def plan_chunk_ranges(
    duration: float, silences: list[Silence], hard_limit: float
) -> tuple[list[ChunkRange], int]:
    """
    Decide where to cut `duration` seconds of audio, given its pauses

    Only arithmetic on the pauses ffmpeg already found; the audio is never read.

    Walks forward from the start. While more than `hard_limit` is left, it picks
    a pause within the next `hard_limit` seconds (see
    `GOOD_ENOUGH_SILENCE_FRACTION`) and cuts at its middle, so neither side
    clips speech. With no pause in reach, it cuts at exactly `hard_limit`, a
    "blind cut". What is left becomes the last chunk.

    Chunks are uneven by design: a 90 min file with pauses only at 10:00 and
    60:00 becomes 10 + 50 + 30 min.

    Returns `(ranges, blind_cuts)`. The ranges follow on from each other and
    cover the whole file. Any blind cuts tell the caller to look for pauses
    again at a louder threshold.
    """

    # An infinite or missing duration would never bring the walk within
    # `hard_limit` of the end, so it would append chunks until the process ran
    # out of memory. A zero or negative one yields a chunk that cannot be cut
    if not isfinite(duration) or duration <= 0:
        raise ValueError('`duration` must be a positive, finite number of seconds')

    if not isfinite(hard_limit) or hard_limit <= 0:
        raise ValueError('`hard_limit` must be a positive, finite number of seconds')

    ranges = []
    blind_cuts = 0
    start = 0.0

    while duration - start > hard_limit:
        limit = start + hard_limit
        # Leave a remainder worth sending, as long as there is still room for
        # a chunk in front of it (see `MIN_LAST_CHUNK_SECONDS`)
        if duration - limit < MIN_LAST_CHUNK_SECONDS:
            pulled_in = duration - MIN_LAST_CHUNK_SECONDS
            if pulled_in > start:
                limit = pulled_in
        # The pauses this chunk could end in. A pause that begins before
        # `limit` but runs past it is only usable while its middle is still
        # inside the window, because the middle is where we cut
        candidates = [
            silence for silence in silences if start < silence.midpoint <= limit
        ]

        if candidates:
            longest = max(candidate.duration for candidate in candidates)
            # Among the pauses that are good enough, take the furthest along
            cut = max(
                (
                    candidate
                    for candidate in candidates
                    if candidate.duration >= longest * GOOD_ENOUGH_SILENCE_FRACTION
                ),
                key=lambda candidate: candidate.start,
            ).midpoint
        else:
            # Only audio with no pause at all for `hard_limit` straight gets
            # here, such as music or a very loud room, and it is cut
            # mid-sentence
            cut = limit
            blind_cuts += 1

        ranges.append(ChunkRange(index=len(ranges), start=start, end=cut))
        start = cut

    # Whatever is left over is the last chunk, however short it turned out to
    # be. Every chunk starts where the previous one ended, so the ranges add up
    # to `duration` exactly
    ranges.append(ChunkRange(index=len(ranges), start=start, end=duration))

    return ranges, blind_cuts


def get_chunk_ranges(
    attachment: Attachment,
    duration: float | None = None,
) -> list[ChunkRange]:
    """
    Return where `attachment` should be cut for transcription

    Only the start and end of each chunk are worked out: no audio is cut and
    no file is written. The web request that asks for this returns long before
    the chunks are transcribed, and anything it wrote to disk would be gone by
    the time a Celery worker, running on another machine, came looking for it.

    It can cause one database write. Called without `duration`, it asks
    `get_audio_duration()`, which saves what it measures to
    `attachment.audio_length` when that column is still empty so that the next
    call is instant. Passing `duration` keeps this read-only.

    ffmpeg reads the audio through once, front to back, and reports every pause
    it hears along the way. `plan_chunk_ranges` then picks the cuts out of that
    one list, so ffmpeg is never run per chunk and nothing ever seeks back
    through the file. The audio is only read again when a cut had no pause to
    land in: detection then starts over at a louder threshold, at most once per
    entry in the ladder, and usually not at all.

    The limit comes from `TRANSCRIPTION_CHUNK_HARD_LIMIT_SECONDS`: one setting
    for every engine, set to the lowest limit among the engines we use, so it
    is safe whichever one transcribes the file.
    """

    hard_limit = settings.TRANSCRIPTION_CHUNK_HARD_LIMIT_SECONDS

    if duration is None:
        duration = get_audio_duration(attachment)

    # `audio_length` is an unvalidated float column and ffprobe parses whatever
    # the container claims, so a duration can arrive unusable rather than absent
    if duration is None or not isfinite(duration) or duration <= 0:
        raise AudioDurationUnknownError(
            f'Cannot determine a usable duration for '
            f'{attachment.media_file_basename}: {duration!r}'
        )

    thresholds = settings.TRANSCRIPTION_SILENCE_THRESHOLDS_DB
    if not thresholds:
        raise ValueError(
            '`TRANSCRIPTION_SILENCE_THRESHOLDS_DB` must hold at least one threshold'
        )

    # A quiet recording is planned on the first pass. A loud one has nothing
    # below -30 dB, so we listen again for anything below -25, then -20
    for threshold_db in thresholds:
        silences = detect_silences(
            attachment.absolute_path,
            duration,
            threshold_db,
            settings.TRANSCRIPTION_SILENCE_MIN_DURATION,
            settings.TRANSCRIPTION_SILENCE_DETECT_TIMEOUT,
        )
        ranges, blind_cuts = plan_chunk_ranges(duration, silences, hard_limit)
        logging.info(
            'Planned %d transcription chunk(s) for attachment %s at %d dB: '
            '%d pause(s) found, %d cut(s) with no pause to land in',
            len(ranges),
            attachment.pk,
            threshold_db,
            len(silences),
            blind_cuts,
        )
        if not blind_cuts:
            break
    else:
        # Every threshold was tried and some cut still had no pause to land
        # in, so those chunks are cut mid-sentence
        logging.warning(
            'Attachment %s still has %d transcription chunk cut(s) with no '
            'pause to land in at %d dB, the loudest threshold tried',
            attachment.pk,
            blind_cuts,
            thresholds[-1],
        )

    return ranges
