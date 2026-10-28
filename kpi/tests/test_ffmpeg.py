import os
import tempfile
from unittest import skipUnless

from django.test import SimpleTestCase

from kpi.exceptions import FFMpegException
from kpi.utils.ffmpeg import (
    FFMPEG_BINARY,
    Silence,
    decode_args,
    detect_silences,
    parse_silences,
    run_ffmpeg,
    silencedetect_args,
)

# Captured from `ffmpeg -i <file> -ac 1 -vn -af silencedetect=noise=-30dB:d=0.5
# -f null -`. ffmpeg interleaves the filter's lines with its own progress
# output, which is why one of them does not start at the beginning of a line
SILENCEDETECT_STDERR = (
    '  Duration: 00:00:06.00, start: 0.000000, bitrate: 342 kb/s\n'
    'size=       0kB time=00:00:00.00 bitrate=N/A speed=   0x    '
    '[silencedetect @ 0x64dcbec139c0] silence_start: 2\n'
    '[silencedetect @ 0x64dcbec139c0] silence_end: 3.50002 | '
    'silence_duration: 1.50002\n'
)


def build_sample(path: str) -> float:
    """
    Write a 6 second audio file to `path`: a tone, 1.5 seconds of silence from
    2.0 to 3.5, then another tone. Returns its duration.

    Built from three inputs rather than one expression because a comma inside
    a filter argument would be read as the start of the next filter.
    """

    run_ffmpeg([
        '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=2',
        '-f', 'lavfi', '-i', 'anullsrc=duration=1.5',
        '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=2.5',
        '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]',
        '-map', '[out]',
        '-y', path,
    ])

    return 6.0


class SilenceTestCase(SimpleTestCase):

    def test_duration_and_midpoint(self):
        silence = Silence(start=10.0, end=12.5)
        self.assertEqual(silence.duration, 2.5)
        self.assertEqual(silence.midpoint, 11.25)


class FFMpegArgumentsTestCase(SimpleTestCase):

    def test_decode_args_read_one_audio_stream(self):
        self.assertEqual(
            decode_args('/tmp/recording.mp3'),
            ['-i', '/tmp/recording.mp3', '-ac', '1', '-vn'],
        )

    def test_silencedetect_args(self):
        self.assertEqual(
            silencedetect_args(-25, 0.5),
            ['-af', 'silencedetect=noise=-25dB:d=0.5'],
        )


class ParseSilencesTestCase(SimpleTestCase):

    def test_parse_captured_output(self):
        silences = parse_silences(SILENCEDETECT_STDERR, duration=6.0)
        self.assertEqual(silences, [Silence(start=2.0, end=3.50002)])

    def test_no_silence_reported(self):
        self.assertEqual(parse_silences('', duration=6.0), [])

    def test_several_silences_keep_their_order(self):
        stderr = (
            'silence_start: 1.5\nsilence_end: 2.5\n'
            'silence_start: 7.0\nsilence_end: 9.25\n'
        )
        self.assertEqual(
            parse_silences(stderr, duration=20.0),
            [Silence(start=1.5, end=2.5), Silence(start=7.0, end=9.25)],
        )

    def test_run_left_open_is_closed_at_the_end_of_the_file(self):
        stderr = (
            'silence_start: 1.5\nsilence_end: 2.5\n'
            'silence_start: 7.0\n'
        )
        self.assertEqual(
            parse_silences(stderr, duration=9.0),
            [Silence(start=1.5, end=2.5), Silence(start=7.0, end=9.0)],
        )

    def test_run_starting_past_the_end_of_the_file_is_dropped(self):
        self.assertEqual(
            parse_silences('silence_start: 12.0\n', duration=9.0), []
        )


@skipUnless(os.path.exists(FFMPEG_BINARY), f'{FFMPEG_BINARY} is not installed')
class RunFFMpegTestCase(SimpleTestCase):

    def test_failure_raises(self):
        with self.assertRaises(FFMpegException):
            run_ffmpeg(['-i', '/nonexistent/recording.mp3', '-f', 'null', '-'])

    def test_detect_silences_finds_the_quiet_run(self):
        """
        Run the real command against real audio, so that the arguments we send
        ffmpeg are checked and not only the parsing of what it answers
        """

        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, 'sample.flac')
            duration = build_sample(path)

            silences = detect_silences(
                path, duration, threshold_db=-30, min_duration=0.5
            )

        self.assertEqual(len(silences), 1)
        self.assertAlmostEqual(silences[0].start, 2.0, delta=0.1)
        self.assertAlmostEqual(silences[0].end, 3.5, delta=0.1)

    def test_detect_silences_ignores_runs_under_the_minimum_duration(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, 'sample.flac')
            duration = build_sample(path)

            silences = detect_silences(
                path, duration, threshold_db=-30, min_duration=2.0
            )

        self.assertEqual(silences, [])
