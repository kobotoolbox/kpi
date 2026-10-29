import re
import subprocess
from dataclasses import dataclass

from kpi.exceptions import FFMpegException
from kpi.utils.log import logging

FFMPEG_BINARY = '/usr/bin/ffmpeg'

# `silencedetect` writes a `silence_start` line when a quiet run begins and a
# matching `silence_end` when it ends, both at the default `info` log level
SILENCE_START_RE = re.compile(r'silence_start:\s*(-?[\d.]+)')
SILENCE_END_RE = re.compile(r'silence_end:\s*(-?[\d.]+)')


@dataclass(frozen=True)
class Silence:
    """
    A quiet run in an audio file, in seconds from its start
    """

    start: float
    end: float

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def midpoint(self) -> float:
        """
        Where to cut so that neither side of the cut clips speech
        """
        return (self.start + self.end) / 2


def run_ffmpeg(args: list[str]) -> subprocess.CompletedProcess:
    """
    Run ffmpeg with `args` and return the completed process

    `stdout` holds whatever ffmpeg wrote to `pipe:1`, and `stderr` the log
    output that filters such as `silencedetect` report through. Raises
    `FFMpegException` when ffmpeg exits non-zero.
    """

    pipe = subprocess.run(
        [FFMPEG_BINARY, *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    if pipe.returncode:
        logging.error(f'ffmpeg error: {pipe.stderr}')
        raise FFMpegException

    return pipe


def decode_args(path_or_url: str) -> list[str]:
    """
    Arguments that read `path_or_url` as a single audio stream, video dropped

    Every pass we make over an attachment starts with these, so that silence
    detection listens to the same mono signal the transcription service will
    be given.
    """

    return ['-i', path_or_url, '-ac', '1', '-vn']


def silencedetect_args(threshold_db: int, min_duration: float) -> list[str]:
    """
    Arguments that make ffmpeg report the quiet runs it decodes

    `noise` is the loudness under which audio counts as silence, and `d` the
    shortest run worth reporting: anything shorter is the gap between two
    words, where a cut would split a sentence.
    """

    return ['-af', f'silencedetect=noise={threshold_db}dB:d={min_duration}']


def parse_silences(stderr: str, duration: float) -> list[Silence]:
    """
    Read the quiet runs that `silencedetect` reported out of ffmpeg's log

    Starts and ends are paired by position, and a run left open is closed at
    `duration`. ffmpeg closes the last run at the end of the file, but a
    truncated stream does not always reach that point.
    """

    starts = [float(match) for match in SILENCE_START_RE.findall(stderr)]
    ends = [float(match) for match in SILENCE_END_RE.findall(stderr)]

    silences = []
    for index, start in enumerate(starts):
        end = ends[index] if index < len(ends) else duration
        # A run reported beyond the duration we were given, which happens with
        # a truncated stream, has nothing in it to cut
        if end > start:
            silences.append(Silence(start=start, end=end))

    return silences


def detect_silences(
    path_or_url: str,
    duration: float,
    threshold_db: int,
    min_duration: float,
) -> list[Silence]:
    """
    Decode the audio at `path_or_url` and return the quiet runs in it

    Nothing is encoded (`-f null`), so this costs one decode pass and no more.
    """

    pipe = run_ffmpeg(
        [
            *decode_args(path_or_url),
            *silencedetect_args(threshold_db, min_duration),
            '-f',
            'null',
            '-',
        ]
    )

    return parse_silences(pipe.stderr.decode(errors='replace'), duration)
