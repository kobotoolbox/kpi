from kobo.apps.subsequences.utils.repetition import collapse_runaway_repetitions


def test_collapses_bigram_loop_and_keeps_leading_text():
    text = 'the story begins here ' + 'na niko, ' * 300
    result = collapse_runaway_repetitions(text.strip(), max_repeats=5)

    assert result == 'the story begins here ' + ('na niko, ' * 5).strip()
    assert result.count('niko') == 5


def test_returns_byte_identical_when_at_or_below_threshold():
    text = 'na niko,  na niko, na niko, na niko, na niko,'
    result = collapse_runaway_repetitions(text, max_repeats=5)

    assert result is text


def test_normalization_ignores_case_and_trailing_punctuation():
    text = 'Na niko, ' + 'na niko. ' * 400
    result = collapse_runaway_repetitions(text.strip(), max_repeats=3)

    # The run is one loop despite case/punctuation drift, trimmed to 3 copies
    # while the kept occurrences preserve their original spelling.
    assert result == 'Na niko, na niko. na niko.'


def test_collapses_unigram_run():
    text = 'yes ' + 'no ' * 200
    result = collapse_runaway_repetitions(text.strip(), max_repeats=4)

    assert result == 'yes no no no no'


def test_collapses_trigram_run():
    text = 'one two three ' * 100
    result = collapse_runaway_repetitions(text.strip(), max_repeats=2)

    assert result == 'one two three one two three'


def test_collapses_loop_starting_at_odd_offset():
    text = 'intro ' + 'na niko, ' * 300
    result = collapse_runaway_repetitions(text.strip(), max_repeats=5)

    assert result == 'intro ' + ('na niko, ' * 5).strip()


def test_disabled_when_max_repeats_is_zero():
    text = 'na niko, ' * 500
    result = collapse_runaway_repetitions(text, max_repeats=0)

    assert result is text


def test_empty_string_returns_empty_string():
    assert collapse_runaway_repetitions('', max_repeats=5) == ''
