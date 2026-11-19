import json
import re
import subprocess
from dataclasses import dataclass

from kpi.exceptions import FFMpegException
from kpi.utils.log import logging

FFMPEG_BINARY = '/usr/bin/ffmpeg'

# `silencedetect` writes a `silence_start` line when a quiet run begins and a
# matching `silence_end` when it ends, both at the default `info` log level.
# The exponent is optional but has to be accepted: ffmpeg prints these with
# `%g`, which switches to scientific notation below 0.0001, so a run beginning
# one sample into a 44.1 kHz file reads `silence_start: 2.26757e-05`. Reading
# that as 2.26757 would move the run most of the way through the file.
SILENCE_START_RE = re.compile(r'silence_start:\s*(-?[\d.]+(?:[eE][+-]?\d+)?)')
SILENCE_END_RE = re.compile(r'silence_end:\s*(-?[\d.]+(?:[eE][+-]?\d+)?)')


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


def run_ffmpeg(
    args: list[str], timeout: float | None = None
) -> subprocess.CompletedProcess:
    """
    Run ffmpeg with `args` and return the completed process

    `stdout` holds whatever ffmpeg wrote to `pipe:1`, and `stderr` the log
    output that filters such as `silencedetect` report through. Raises
    `FFMpegException` when ffmpeg exits non-zero or outruns `timeout`.

    `timeout` is in seconds, and `None` waits forever. Pass one whenever the
    input may be a presigned URL, so that storage going slow cannot hold the
    caller open indefinitely.

    `-hide_banner` drops the version and build configuration ffmpeg otherwise
    prints before anything useful.
    """

    try:
        pipe = subprocess.run(
            [FFMPEG_BINARY, '-hide_banner', *args],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        # Deliberately without the arguments, which carry the presigned URL
        logging.error('ffmpeg timed out after %s seconds', timeout)
        raise FFMpegException

    if pipe.returncode:
        # Decoded rather than logged as bytes, so that the lines ffmpeg wrote
        # read as lines instead of one `b'...\n...'` blob. `replace` keeps a
        # stray non-UTF-8 byte in a filename from raising in the error path
        stderr = pipe.stderr.decode(errors='replace')
        # Query strings carry the presigned URL signature, which ffmpeg quotes
        # back in its error lines. This log line reaches Sentry as an event
        # too, where the URL would still be valid
        logging.error('ffmpeg error: %s', re.sub(r'\?\S+', '?[redacted]', stderr))
        raise FFMpegException

    return pipe


def decode_args(path_or_url: str) -> list[str]:
    """
    Arguments that read `path_or_url` as a single audio stream, video dropped

    Every pass we make over an attachment starts with these, so that detection
    and conversion read the file the same way. `-ac 1` asks for mono output;
    note that it constrains what ffmpeg writes, not what filters see.
    """

    return ['-i', path_or_url, '-ac', '1', '-vn']


def silencedetect_args(threshold_db: int, min_duration: float) -> list[str]:
    """
    Arguments that make ffmpeg report the quiet runs it decodes

    `noise` is the loudness under which audio counts as silence, and `d` the
    shortest run worth reporting: anything shorter is the gap between two
    words, where a cut would split a sentence.

    The downmix to mono is part of this chain rather than left to `-ac 1`,
    which applies on the way out and so would come after `silencedetect` had
    already listened. That matters on stereo recordings, because a moment
    counts as silent only while every channel is below the threshold: a hum in
    one channel alone hides every pause in the file, even where the mono mix
    the transcription service receives is quiet.
    """

    return [
        '-af',
        'aformat=channel_layouts=mono,'
        f'silencedetect=noise={threshold_db}dB:d={min_duration}',
    ]


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
    timeout: float | None = None,
) -> list[Silence]:
    """
    Decode the audio at `path_or_url` and return the quiet runs in it

    Nothing is encoded (`-f null`), so this costs one decode pass and no more.
    Pass a `timeout` whenever `path_or_url` may be a presigned URL.
    """

    stderr = _run_silencedetect(
        path_or_url, threshold_db, min_duration, ['-f', 'null', '-'], timeout
    )
    return parse_silences(stderr, duration)


def convert_and_detect_silences(
    path_or_url: str,
    output_path: str,
    threshold_db: int,
    min_duration: float,
    timeout: float | None = None,
) -> tuple[list[Silence], float]:
    """
    Convert the audio at `path_or_url` to a mono FLAC file at `output_path`,
    and return the quiet runs in it along with its duration

    One decode pass does both, so a recording in remote storage is downloaded
    once. The duration is read from the file just written rather than from
    the original's header, which may be missing or a little off, so it is the
    length of the audio that will actually be cut.
    """
    stderr = _run_silencedetect(
        path_or_url,
        threshold_db,
        min_duration,
        ['-f', 'flac', '-y', output_path],
        timeout,
    )
    if (duration := probe_duration(output_path)) is None:
        # ffmpeg reported success, so the file it wrote should be readable
        raise FFMpegException
    return parse_silences(stderr, duration), duration


def cut_audio(
    source_path: str,
    start: float,
    end: float,
    output_path: str,
    timeout: float | None = None,
) -> None:
    """
    Write the audio of `source_path` between `start` and `end` seconds to its
    own FLAC file at `output_path`

    The slice is encoded again rather than copied (`-c copy`). A copied FLAC
    keeps the original's header, which states the length of the whole file:
    a 55 min chunk of a 2 h recording would claim to be 2 h long. Encoding is
    cheap on a local file, and placing `-ss` before the input makes ffmpeg
    seek to `start` instead of decoding everything before it.
    """

    # fmt: off
    run_ffmpeg(
        [
            '-ss', _format_seconds(start),
            '-to', _format_seconds(end),
            *decode_args(source_path),
            '-f', 'flac',
            '-y', output_path,
        ],
        timeout=timeout,
    )
    # fmt: on


def probe_duration(path_or_url: str, label: str = '') -> float | None:
    """
    Return the duration in seconds that ffprobe reads for `path_or_url`, or
    `None` when it cannot tell (unsupported format, corrupt file, network
    error, etc.)

    `label` names the file in the log instead of `path_or_url`, which may be a
    presigned URL.
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


def _format_seconds(seconds: float) -> str:
    """
    Write `seconds` the way ffmpeg reads a time

    `str()` would switch to scientific notation for a tiny value such as
    `1e-05`, which ffmpeg does not accept.
    """
    return f'{seconds:.6f}'


def _run_silencedetect(
    path_or_url: str,
    threshold_db: int,
    min_duration: float,
    output_args: list[str],
    timeout: float | None,
) -> str:
    """
    Decode `path_or_url` through `silencedetect`, send the result to
    `output_args`, and return the log the pauses are reported in
    """

    pipe = run_ffmpeg(
        [
            *decode_args(path_or_url),
            *silencedetect_args(threshold_db, min_duration),
            *output_args,
        ],
        timeout=timeout,
    )
    return pipe.stderr.decode(errors='replace')
