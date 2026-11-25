from unittest.mock import MagicMock, patch

import pytest
from django.test import SimpleTestCase, override_settings

from kpi.exceptions import AudioDurationUnknownError
from kpi.utils.audio_chunking import (
    MIN_LAST_CHUNK_SECONDS,
    ChunkRange,
    convert_and_plan_chunks,
    plan_chunk_ranges,
)
from kpi.utils.ffmpeg import Silence

HARD_LIMIT = 55 * 60


def minutes(value: float) -> float:
    return value * 60


def pause_at(start: float, length: float = 1.0) -> Silence:
    """
    A `length` second pause centred on `start` seconds, so that its midpoint,
    which is where the cut lands, is exactly `start`
    """

    return Silence(start=start - length / 2, end=start + length / 2)


def assert_ranges_cover_the_file(ranges, duration, hard_limit):
    """
    Check what has to hold of every plan, whatever the pauses look like
    """

    assert [chunk.index for chunk in ranges] == list(range(len(ranges)))
    assert ranges[0].start == 0.0
    assert ranges[-1].end == duration
    assert sum(chunk.duration for chunk in ranges) == pytest.approx(duration, abs=1e-6)
    for chunk, following in zip(ranges, ranges[1:]):
        assert chunk.end == following.start
    for chunk in ranges:
        assert chunk.duration > 0
        assert chunk.duration <= hard_limit


class PlanChunkRangesTestCase(SimpleTestCase):

    def test_audio_under_the_hard_limit_is_one_chunk(self):
        ranges, blind_cuts = plan_chunk_ranges(
            minutes(30), [pause_at(minutes(10))], HARD_LIMIT
        )

        assert ranges == [ChunkRange(index=0, start=0.0, end=minutes(30))]
        assert blind_cuts == 0

    def test_audio_of_exactly_the_hard_limit_is_one_chunk(self):
        ranges, blind_cuts = plan_chunk_ranges(
            HARD_LIMIT, [pause_at(minutes(10))], HARD_LIMIT
        )

        assert ranges == [ChunkRange(index=0, start=0.0, end=HARD_LIMIT)]
        assert blind_cuts == 0

    def test_sparse_pauses_give_uneven_chunks(self):
        """
        The example from DEV-2915: a 90 minute file whose only pauses are at
        10:00 and 60:00 is cut into 10, 50 and 30 minutes, rather than cut
        blind into two 45 minute halves
        """

        ranges, blind_cuts = plan_chunk_ranges(
            minutes(90),
            [pause_at(minutes(10)), pause_at(minutes(60))],
            HARD_LIMIT,
        )

        assert [chunk.duration for chunk in ranges] == [
            minutes(10),
            minutes(50),
            minutes(30),
        ]
        assert blind_cuts == 0
        assert_ranges_cover_the_file(ranges, minutes(90), HARD_LIMIT)

    def test_pauses_throughout_cut_close_to_the_hard_limit(self):
        """
        Normal audio has hundreds of pauses, so the cut lands near the limit
        """

        duration = minutes(120)
        silences = [pause_at(second) for second in range(60, int(duration), 60)]

        ranges, blind_cuts = plan_chunk_ranges(duration, silences, HARD_LIMIT)

        assert blind_cuts == 0
        assert len(ranges) == 3
        assert ranges[0].end == HARD_LIMIT
        assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_the_longest_pause_in_range_wins(self):
        ranges, blind_cuts = plan_chunk_ranges(
            minutes(90),
            [
                pause_at(minutes(44), length=0.6),
                pause_at(minutes(46), length=2.4),
                pause_at(minutes(48), length=0.8),
            ],
            HARD_LIMIT,
        )

        assert ranges[0].end == minutes(46)
        assert blind_cuts == 0

    def test_the_later_of_two_similar_pauses_wins(self):
        """
        Keeping chunks as long as the limit allows means preferring the later
        pause when neither is clearly the clearer one
        """

        ranges, _ = plan_chunk_ranges(
            minutes(90),
            [pause_at(minutes(44), length=2.0), pause_at(minutes(50), length=1.9)],
            HARD_LIMIT,
        )

        assert ranges[0].end == minutes(50)

    def test_a_slightly_shorter_later_pause_wins(self):
        """
        Taken from `audio_salome.mp3`, where the pauses in one 15 minute window
        were 0.92s three seconds in and 0.66s four minutes later. Preferring
        the longest left a 3 second chunk, which costs a whole transcription
        request to carry three seconds of audio
        """

        ranges, _ = plan_chunk_ranges(
            minutes(90),
            [
                pause_at(minutes(44) + 3, length=0.92),
                pause_at(minutes(48), length=0.66),
            ],
            HARD_LIMIT,
        )

        assert ranges[0].end == minutes(48)
        assert ranges[0].duration > minutes(47)

    def test_a_clearly_shorter_later_pause_does_not_win(self):
        ranges, _ = plan_chunk_ranges(
            minutes(90),
            [pause_at(minutes(44), length=2.0), pause_at(minutes(50), length=0.4)],
            HARD_LIMIT,
        )

        assert ranges[0].end == minutes(44)

    def test_a_tail_shorter_than_the_minimum_is_not_left_behind(self):
        """
        A file only just over the limit would otherwise end in a stub: 55:00
        plus 0.04 seconds, a whole transcription request for nothing
        """

        ranges, _ = plan_chunk_ranges(HARD_LIMIT + 0.04, [], HARD_LIMIT)

        assert len(ranges) == 2
        assert ranges[-1].duration == pytest.approx(MIN_LAST_CHUNK_SECONDS)
        assert ranges[0].duration <= HARD_LIMIT
        assert_ranges_cover_the_file(ranges, HARD_LIMIT + 0.04, HARD_LIMIT)

    def test_the_window_is_pulled_in_to_reach_a_pause_before_the_tail(self):
        """
        Taken from `MARIAM BOLE`, where the last cut fell 1.8s before the end
        of the file and left a 1.8 second chunk
        """

        duration = HARD_LIMIT + 10
        ranges, blind_cuts = plan_chunk_ranges(
            duration,
            [pause_at(HARD_LIMIT - 100), pause_at(HARD_LIMIT - 2)],
            HARD_LIMIT,
        )

        assert ranges[0].end == HARD_LIMIT - 100
        assert ranges[-1].duration >= MIN_LAST_CHUNK_SECONDS
        assert blind_cuts == 0
        assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_audio_without_any_pause_is_cut_blind(self):
        duration = minutes(90)

        ranges, blind_cuts = plan_chunk_ranges(duration, [], HARD_LIMIT)

        assert [chunk.duration for chunk in ranges] == [
            HARD_LIMIT,
            duration - HARD_LIMIT,
        ]
        assert blind_cuts == 1
        assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_a_pause_straddling_the_hard_limit_is_not_used(self):
        """
        Cutting through the middle of a pause that ends after the limit would
        leave the chunk longer than the limit, so an earlier pause is used
        """

        duration = minutes(90)
        straddling = Silence(start=HARD_LIMIT - 1, end=HARD_LIMIT + 10)

        ranges, blind_cuts = plan_chunk_ranges(
            duration, [pause_at(minutes(40)), straddling], HARD_LIMIT
        )

        assert ranges[0].end == minutes(40)
        assert blind_cuts == 0
        assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_a_pause_straddling_the_hard_limit_alone_cuts_blind(self):
        duration = minutes(90)
        straddling = Silence(start=HARD_LIMIT - 1, end=HARD_LIMIT + 10)

        ranges, blind_cuts = plan_chunk_ranges(duration, [straddling], HARD_LIMIT)

        assert ranges[0].end == HARD_LIMIT
        assert blind_cuts == 1
        assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_pauses_already_passed_are_not_reused(self):
        """
        A single pause in a very long file is used once, and the rest of the
        file is cut blind from there
        """

        duration = minutes(180)

        ranges, blind_cuts = plan_chunk_ranges(
            duration, [pause_at(minutes(20))], HARD_LIMIT
        )

        assert [chunk.duration for chunk in ranges] == [
            minutes(20),
            HARD_LIMIT,
            HARD_LIMIT,
            minutes(180 - 20) - 2 * HARD_LIMIT,
        ]
        assert blind_cuts == 2
        assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_a_hard_limit_that_is_not_a_positive_number_is_refused(self):
        """
        A misconfigured limit would otherwise never move the walk forward, or
        silently leave a long file as a single chunk
        """

        for hard_limit in (0, -1, float('nan'), float('inf')):
            with pytest.raises(ValueError):
                plan_chunk_ranges(minutes(90), [], hard_limit)

    def test_a_duration_that_is_not_a_positive_number_is_refused(self):
        """
        An infinite duration is never within `hard_limit` of the end, so the
        walk would append chunks until the process ran out of memory. Zero or
        less yields a chunk that cannot be cut at all
        """

        for duration in (0.0, -5.0, float('nan'), float('inf')):
            with pytest.raises(ValueError):
                plan_chunk_ranges(duration, [], HARD_LIMIT)


@override_settings(
    TRANSCRIPTION_SILENCE_MIN_DURATION=0.5,
    TRANSCRIPTION_SILENCE_THRESHOLDS_DB=(-30, -25, -20),
    TRANSCRIPTION_SILENCE_DETECT_TIMEOUT=300,
)
class ConvertAndPlanChunksTestCase(SimpleTestCase):

    SOURCE = 'https://storage.example/recording.mp3?signature=secret'
    FLAC = '/tmp/work/source.flac'

    def setUp(self):
        self.attachment = MagicMock(
            pk=1,
            absolute_path=self.SOURCE,
            media_file_basename='recording.mp3',
        )

    def _plan(self, converted, louder=None, hard_limit=HARD_LIMIT):
        """
        Plan with the conversion pass returning `converted`, a
        `(silences, duration)` pair, and the louder passes returning `louder`
        in turn, or no pause when it is not given. Returns the plan and both
        mocks
        """

        louder_passes = {'side_effect': louder} if louder else {'return_value': []}
        with patch(
            'kpi.utils.audio_chunking.convert_and_detect_silences',
            return_value=converted,
        ) as convert, patch(
            'kpi.utils.audio_chunking.detect_silences', **louder_passes
        ) as detect:
            ranges = convert_and_plan_chunks(self.attachment, self.FLAC, hard_limit)

        return ranges, convert, detect

    def test_pauses_found_while_converting(self):
        """
        A quiet recording is planned on the pauses heard during the conversion,
        so it is read once and nothing else
        """

        ranges, convert, detect = self._plan(([pause_at(minutes(50))], minutes(90)))

        assert ranges[0].end == minutes(50)
        convert.assert_called_once_with(self.SOURCE, self.FLAC, -30, 0.5, 300)
        detect.assert_not_called()

    def test_nothing_is_warned_about_when_the_pauses_are_found(self):
        with patch('kpi.utils.audio_chunking.logging') as logger:
            self._plan(([pause_at(minutes(50))], minutes(90)))

        logger.warning.assert_not_called()

    def test_louder_thresholds_listen_to_the_local_copy(self):
        """
        A loud recording has nothing below -30 dB, so detection runs again at
        each louder threshold until the pauses appear, on the FLAC already
        written rather than the original, which would be downloaded again
        """

        ranges, _, detect = self._plan(
            ([], minutes(90)), louder=[[], [pause_at(minutes(50))]]
        )

        assert [call.args for call in detect.call_args_list] == [
            (self.FLAC, minutes(90), -25, 0.5, 300),
            (self.FLAC, minutes(90), -20, 0.5, 300),
        ]
        assert ranges[0].end == minutes(50)

    def test_plan_from_the_last_threshold_is_used_when_no_pause_is_found(self):
        """
        A recording with no detectable silence at all is still transcribed,
        cut blind at the hard limit
        """

        ranges, _, detect = self._plan(([], minutes(90)), louder=[[], []])

        assert detect.call_count == 2
        assert ranges[0].end == HARD_LIMIT

    def test_a_file_cut_blind_at_every_threshold_is_logged_as_a_warning(self):
        """
        A file cut mid-sentence should stand out from the info lines, since
        nothing else in the logs distinguishes it
        """

        with patch('kpi.utils.audio_chunking.logging') as logger:
            self._plan(([], minutes(90)), louder=[[], []])

        assert logger.warning.call_count == 1
        message, *args = logger.warning.call_args.args
        assert 'no pause to land in' in message
        assert args[-1] == -20

    def test_cuts_are_planned_on_the_length_of_the_converted_file(self):
        """
        The duration stored for the attachment comes from the original's
        header, which can be a little off. The plan follows the audio that
        will actually be cut, so its last chunk ends where that audio ends
        """

        self.attachment.audio_length = minutes(90) + 0.5

        ranges, _, _ = self._plan(([pause_at(minutes(50))], minutes(90)))

        assert ranges[-1].end == minutes(90)
        assert_ranges_cover_the_file(ranges, minutes(90), HARD_LIMIT)

    def test_the_hard_limit_comes_from_the_caller(self):
        """
        Each engine has its own limit, so the same recording planned for a
        tighter engine is cut more finely. Nothing here is read from settings:
        the caller passes the limit of whichever engine is about to transcribe
        """

        pauses = [pause_at(minutes(14)), pause_at(minutes(50))]
        roomy, _, _ = self._plan((pauses, minutes(90)))
        # The tighter limit leaves a cut with no pause in reach, so the louder
        # passes run too, and hear the same pauses
        tighter, _, _ = self._plan(
            (pauses, minutes(90)), louder=[pauses, pauses], hard_limit=minutes(15)
        )

        assert [chunk.duration for chunk in roomy] == [minutes(50), minutes(40)]
        assert tighter[0].end == minutes(14)
        assert len(tighter) > len(roomy)
        for chunk in tighter:
            assert chunk.duration <= minutes(15)

    def test_an_unusable_duration_is_refused(self):
        """
        A converted file with no usable length leaves nothing to plan on
        """

        for duration in (0.0, -1.0, float('nan'), float('inf')):
            with pytest.raises(AudioDurationUnknownError):
                self._plan(([], duration))

    @override_settings(TRANSCRIPTION_SILENCE_THRESHOLDS_DB=())
    def test_an_empty_threshold_ladder_is_refused_before_converting(self):
        """
        An empty ladder would otherwise leave the file with no plan at all, so
        it is refused before the recording is downloaded
        """

        with patch(
            'kpi.utils.audio_chunking.convert_and_detect_silences'
        ) as convert, pytest.raises(ValueError):
            convert_and_plan_chunks(self.attachment, self.FLAC, HARD_LIMIT)

        convert.assert_not_called()
