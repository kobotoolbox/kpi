from dataclasses import dataclass

from django.conf import settings

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kpi.exceptions import AudioDurationUnknownError
from kpi.utils.audio_duration import get_audio_duration
from kpi.utils.ffmpeg import Silence, detect_silences
from kpi.utils.log import logging

# How to choose between two pauses that are both in reach of the same cut. A
# pause at least this fraction as long as the longest one available counts as
# good enough, and of those we take the latest, so chunks stay as long as the
# limit allows.
#
# Example from a real recording: a 0.92s pause three seconds after the previous
# cut, and a 0.66s pause four minutes later. Always taking the longest cuts at
# the 0.92s one and leaves a 3 second chunk, which costs a whole transcription
# request to carry three seconds of audio. At 0.7 the 0.66s pause counts as
# good enough and wins, because it comes later.
GOOD_ENOUGH_SILENCE_FRACTION = 0.7


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
    Decide where to cut `duration` seconds of audio into chunks

    `silences` is every pause in the file, already found by ffmpeg. This
    function only does arithmetic on those numbers and never touches the audio.

    It works forward from the start of the file. For each cut it looks at the
    pauses lying between the previous cut and `hard_limit` after it, and cuts
    through the middle of the best one, so that neither side clips speech.
    "Best" means the latest pause that is nearly as long as the longest one in
    reach: a long pause is the end of a sentence or a change of speaker, a
    short one is a breath between two words, and taking the latest good one
    keeps chunks long, so there are fewer of them to transcribe.

    Chunks therefore come out uneven, because their length depends on where
    people happened to stop talking. With a 55 minute limit, a 90 minute file
    whose only pauses are at 10:00 and 60:00 becomes 10 + 50 + 30 minutes
    rather than two 45 minute halves. That costs nothing, and fewer chunks
    means fewer requests to the transcription service and less to merge.

    Returns the ranges, which join up and together cover the whole file, along
    with the number of cuts that had no pause to land in. A caller that gets a
    count above zero can look for pauses again at a louder threshold and plan
    once more.
    """

    if hard_limit <= 0:
        raise ValueError('`hard_limit` must be a positive number of seconds')

    ranges = []
    blind_cuts = 0
    start = 0.0

    while duration - start > hard_limit:
        limit = start + hard_limit
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
    hard_limit: float | None = None,
) -> list[ChunkRange]:
    """
    Return where `attachment` should be cut for transcription

    Only the start and end of each chunk are worked out: no audio is cut and
    nothing is written anywhere. The web request that asks for this returns
    long before the chunks are transcribed, and anything it wrote to disk would
    be gone by the time a Celery worker, running on another machine, came
    looking for it.

    ffmpeg reads the audio through once, front to back, and reports every pause
    it hears along the way. `plan_chunk_ranges` then picks the cuts out of that
    one list, so ffmpeg is never run per chunk and nothing ever seeks back
    through the file. The audio is only read again when a cut had no pause to
    land in: detection then starts over at a louder threshold, at most once per
    entry in the ladder, and usually not at all.

    `hard_limit` defaults to the setting, which is the lowest limit among the
    engines we use and is therefore safe whichever one transcribes the file. A
    caller that has already resolved the engine can pass that engine's own
    limit instead, so that a file is not cut more finely than it needs to be:
    cutting a 60 minute recording at 15 minutes rather than 55 turns 2 chunks
    into 6, and each chunk is a separate request to the service.
    """

    if hard_limit is None:
        hard_limit = settings.TRANSCRIPTION_CHUNK_HARD_LIMIT_SECONDS

    if duration is None:
        duration = get_audio_duration(attachment)

    if duration is None:
        raise AudioDurationUnknownError(
            f'Cannot determine the duration of {attachment.media_file_basename}'
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

    return ranges
