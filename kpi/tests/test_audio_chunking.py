from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from kpi.exceptions import AudioDurationUnknownError
from kpi.utils.audio_chunking import ChunkRange, get_chunk_ranges, plan_chunk_ranges
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


class PlanChunkRangesTestCase(SimpleTestCase):

    def assert_ranges_cover_the_file(self, ranges, duration, hard_limit):
        """
        Check what has to hold of every plan, whatever the pauses look like
        """

        self.assertEqual([chunk.index for chunk in ranges], list(range(len(ranges))))
        self.assertEqual(ranges[0].start, 0.0)
        self.assertEqual(ranges[-1].end, duration)
        self.assertAlmostEqual(
            sum(chunk.duration for chunk in ranges), duration, places=6
        )
        for chunk, following in zip(ranges, ranges[1:]):
            self.assertEqual(chunk.end, following.start)
        for chunk in ranges:
            self.assertGreater(chunk.duration, 0)
            self.assertLessEqual(chunk.duration, hard_limit)

    def test_audio_under_the_hard_limit_is_one_chunk(self):
        ranges, blind_cuts = plan_chunk_ranges(
            minutes(30), [pause_at(minutes(10))], HARD_LIMIT
        )

        self.assertEqual(ranges, [ChunkRange(index=0, start=0.0, end=minutes(30))])
        self.assertEqual(blind_cuts, 0)

    def test_audio_of_exactly_the_hard_limit_is_one_chunk(self):
        ranges, blind_cuts = plan_chunk_ranges(
            HARD_LIMIT, [pause_at(minutes(10))], HARD_LIMIT
        )

        self.assertEqual(ranges, [ChunkRange(index=0, start=0.0, end=HARD_LIMIT)])
        self.assertEqual(blind_cuts, 0)

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

        self.assertEqual(
            [chunk.duration for chunk in ranges],
            [minutes(10), minutes(50), minutes(30)],
        )
        self.assertEqual(blind_cuts, 0)
        self.assert_ranges_cover_the_file(ranges, minutes(90), HARD_LIMIT)

    def test_pauses_throughout_cut_close_to_the_hard_limit(self):
        """
        Normal audio has hundreds of pauses, so the cut lands near the limit
        """

        duration = minutes(120)
        silences = [pause_at(second) for second in range(60, int(duration), 60)]

        ranges, blind_cuts = plan_chunk_ranges(duration, silences, HARD_LIMIT)

        self.assertEqual(blind_cuts, 0)
        self.assertEqual(len(ranges), 3)
        self.assertEqual(ranges[0].end, HARD_LIMIT)
        self.assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

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

        self.assertEqual(ranges[0].end, minutes(46))
        self.assertEqual(blind_cuts, 0)

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

        self.assertEqual(ranges[0].end, minutes(50))

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

        self.assertEqual(ranges[0].end, minutes(48))
        self.assertGreater(ranges[0].duration, minutes(47))

    def test_a_clearly_shorter_later_pause_does_not_win(self):
        ranges, _ = plan_chunk_ranges(
            minutes(90),
            [pause_at(minutes(44), length=2.0), pause_at(minutes(50), length=0.4)],
            HARD_LIMIT,
        )

        self.assertEqual(ranges[0].end, minutes(44))

    def test_audio_without_any_pause_is_cut_blind(self):
        duration = minutes(90)

        ranges, blind_cuts = plan_chunk_ranges(duration, [], HARD_LIMIT)

        self.assertEqual(
            [chunk.duration for chunk in ranges],
            [HARD_LIMIT, duration - HARD_LIMIT],
        )
        self.assertEqual(blind_cuts, 1)
        self.assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

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

        self.assertEqual(ranges[0].end, minutes(40))
        self.assertEqual(blind_cuts, 0)
        self.assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_a_pause_straddling_the_hard_limit_alone_cuts_blind(self):
        duration = minutes(90)
        straddling = Silence(start=HARD_LIMIT - 1, end=HARD_LIMIT + 10)

        ranges, blind_cuts = plan_chunk_ranges(duration, [straddling], HARD_LIMIT)

        self.assertEqual(ranges[0].end, HARD_LIMIT)
        self.assertEqual(blind_cuts, 1)
        self.assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_pauses_already_passed_are_not_reused(self):
        """
        A single pause in a very long file is used once, and the rest of the
        file is cut blind from there
        """

        duration = minutes(180)

        ranges, blind_cuts = plan_chunk_ranges(
            duration, [pause_at(minutes(20))], HARD_LIMIT
        )

        self.assertEqual(
            [chunk.duration for chunk in ranges],
            [minutes(20), HARD_LIMIT, HARD_LIMIT, minutes(180 - 20) - 2 * HARD_LIMIT],
        )
        self.assertEqual(blind_cuts, 2)
        self.assert_ranges_cover_the_file(ranges, duration, HARD_LIMIT)

    def test_a_hard_limit_of_zero_is_refused(self):
        """
        A misconfigured limit would otherwise never move the walk forward
        """

        with self.assertRaises(ValueError):
            plan_chunk_ranges(minutes(90), [], 0)


@override_settings(
    TRANSCRIPTION_CHUNK_HARD_LIMIT_SECONDS=HARD_LIMIT,
    TRANSCRIPTION_SILENCE_MIN_DURATION=0.5,
    TRANSCRIPTION_SILENCE_THRESHOLDS_DB=(-30, -25, -20),
)
class GetChunkRangesTestCase(SimpleTestCase):

    def setUp(self):
        self.attachment = MagicMock(
            pk=1,
            absolute_path='/tmp/recording.mp3',
            media_file_basename='recording.mp3',
        )

    def test_pauses_found_at_the_first_threshold(self):
        with patch(
            'kpi.utils.audio_chunking.detect_silences',
            return_value=[pause_at(minutes(50))],
        ) as detect_silences:
            ranges = get_chunk_ranges(self.attachment, duration=minutes(90))

        self.assertEqual(ranges[0].end, minutes(50))
        detect_silences.assert_called_once_with(
            '/tmp/recording.mp3', minutes(90), -30, 0.5
        )

    def test_threshold_is_raised_until_every_cut_has_a_pause(self):
        """
        A loud recording has nothing below -30 dB, so detection runs again at
        each higher threshold until the pauses appear
        """

        with patch(
            'kpi.utils.audio_chunking.detect_silences',
            side_effect=[[], [], [pause_at(minutes(50))]],
        ) as detect_silences:
            ranges = get_chunk_ranges(self.attachment, duration=minutes(90))

        self.assertEqual(
            [call.args[2] for call in detect_silences.call_args_list], [-30, -25, -20]
        )
        self.assertEqual(ranges[0].end, minutes(50))

    def test_plan_from_the_last_threshold_is_used_when_no_pause_is_found(self):
        """
        A recording with no detectable silence at all is still transcribed,
        cut blind at the hard limit
        """

        with patch(
            'kpi.utils.audio_chunking.detect_silences', return_value=[]
        ) as detect_silences:
            ranges = get_chunk_ranges(self.attachment, duration=minutes(90))

        self.assertEqual(detect_silences.call_count, 3)
        self.assertEqual(ranges[0].end, HARD_LIMIT)

    def test_duration_is_read_from_the_attachment_when_not_given(self):
        with patch(
            'kpi.utils.audio_chunking.get_audio_duration', return_value=minutes(90)
        ) as get_audio_duration, patch(
            'kpi.utils.audio_chunking.detect_silences',
            return_value=[pause_at(minutes(50))],
        ):
            ranges = get_chunk_ranges(self.attachment)

        get_audio_duration.assert_called_once_with(self.attachment)
        self.assertEqual(ranges[-1].end, minutes(90))

    def test_a_caller_can_override_the_hard_limit(self):
        """
        An engine with a tighter limit than the shared one can ask for it,
        without every other engine having to cut its files that finely
        """

        with patch(
            'kpi.utils.audio_chunking.detect_silences',
            return_value=[pause_at(minutes(14)), pause_at(minutes(50))],
        ):
            shared = get_chunk_ranges(self.attachment, duration=minutes(90))
            tighter = get_chunk_ranges(
                self.attachment, duration=minutes(90), hard_limit=minutes(15)
            )

        self.assertEqual(
            [chunk.duration for chunk in shared], [minutes(50), minutes(40)]
        )
        self.assertEqual(tighter[0].end, minutes(14))
        self.assertGreater(len(tighter), len(shared))
        for chunk in tighter:
            self.assertLessEqual(chunk.duration, minutes(15))

    def test_unknown_duration_is_refused(self):
        with patch(
            'kpi.utils.audio_chunking.get_audio_duration', return_value=None
        ), patch('kpi.utils.audio_chunking.detect_silences') as detect_silences:
            with self.assertRaises(AudioDurationUnknownError):
                get_chunk_ranges(self.attachment)

        detect_silences.assert_not_called()

    @override_settings(TRANSCRIPTION_SILENCE_THRESHOLDS_DB=())
    def test_an_empty_threshold_ladder_is_refused(self):
        """
        An empty ladder would otherwise leave the file with no plan at all
        """

        with self.assertRaises(ValueError):
            get_chunk_ranges(self.attachment, duration=minutes(90))
