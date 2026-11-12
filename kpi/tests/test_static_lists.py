import re

from kobo.static_lists import COUNTRIES


def test_country_codes_are_unique_alpha3():
    codes = [code for code, _ in COUNTRIES]
    assert len(codes) == len(set(codes))
    for code in codes:
        assert re.fullmatch(r'[A-Z]{3}', code), code


def test_country_labels_are_clean():
    for code, label in COUNTRIES:
        assert label, code
        assert label == label.strip(), code


def test_kosovo_is_kept():
    assert dict(COUNTRIES)['XKX'] == 'Kosovo'
