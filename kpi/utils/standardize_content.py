# coding: utf-8
from copy import deepcopy

from formpack.utils.replace_aliases import replace_aliases
from formpack.utils.expand_content import expand_content, SCHEMA_VERSION

ALLOWED_TYPES = {
    'score__row': True,
    'rank__level': True,
    'begin_score': [
        'begin score',
    ],
    'end_score': [
        'end score',
    ],
    'begin_rank': [
        'begin rank',
    ],
    'end_rank': [
        'end rank',
    ],
    'begin_kobomatrix': [
        'begin kobomatrix',
    ],
    'end_kobomatrix': [
        'end kobomatrix',
    ],
}


def needs_standardization(_c):
    if not isinstance(_c, dict):
        raise ValueError("Content argument needs to be a dict")
    return not _c.get('schema') is SCHEMA_VERSION


def standardize_content(content):
    _content = deepcopy(content)
    standardize_content_in_place(_content)
    return _content


def standardize_content_in_place(content):
    if 'settings' not in content:
        content['settings'] = {}
    if 'survey' not in content:
        content['survey'] = []
    expand_content(content, in_place=True)
    replace_aliases(content, in_place=True, allowed_types=ALLOWED_TYPES)
