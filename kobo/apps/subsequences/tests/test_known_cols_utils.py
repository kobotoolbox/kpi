import pytest


from kobo.apps.subsequences.utils.parse_known_cols import (
    parse_known_cols,
)


def test_known_cols_transc_duplicates():
    results = parse_known_cols([
        'col-qpath:transc_a:en',
        'col-qpath:transc_a:en',
    ])
    assert len(results) == 1
    assert results[0]['language'] == 'en'


def test_known_cols_transl_duplicates():
    results = parse_known_cols([
        'col-qpath:transl_a:fr',
        'col-qpath:transl_a:fr',
    ])
    assert len(results) == 1


def test_known_cols_transc_uniqs():
    results = parse_known_cols([
        'col-qpath1:transc_a:en',
        'col-qpath1:transc_b:fr',
        'col-qpath2:transc_a:en',
        'col-qpath2:transc_b:fr',
    ])
    assert len(results) == 4
    rs = {}
    for prop in ['language', 'label', 'qpath']:
        rs[prop] = [rr[prop] for rr in results]
    assert rs['language'] == ['en', 'fr', 'en', 'fr']
    assert rs['label'] == [
        'qpath1 - transcript',
        'qpath1 - transcript',
        'qpath2 - transcript',
        'qpath2 - transcript',
    ]
    assert rs['qpath'] == [
        'qpath1-transcript-en',
        'qpath1-transcript-fr',
        'qpath2-transcript-en',
        'qpath2-transcript-fr',
    ]


def test_known_cols_transl_uniqs():
    results = parse_known_cols([
        'col-qpath1:transl_a:en',
        'col-qpath1:transl_b:fr',
        'col-qpath2:transl_a:en',
        'col-qpath2:transl_b:fr',
    ])
    assert len(results) == 4
    langs = [r['language'] for r in results]
    labls = [r['label'] for r in results]
    qpths = [r['qpath'] for r in results]
    assert qpths == [
        'qpath1-translation-en',
        'qpath1-translation-fr',
        'qpath2-translation-en',
        'qpath2-translation-fr',
    ]


def test_known_cols_combos():
    results = parse_known_cols([
        'col-qpath1:transl_a:en',
        'col-qpath1:transl_b:fr',
        'col-qpath2:transl_a:en',
        'col-qpath2:transl_b:fr',
    ])
    langs = [r['language'] for r in results]
    assert langs == ['en', 'fr', 'en', 'fr']
    assert len(results) == 4
