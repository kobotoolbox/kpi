from copy import deepcopy

from formpack.utils.replace_aliases import replace_aliases
from formpack.utils.expand_content import expand_content, SCHEMA_VERSION

ALLOWED_TYPES = {
    u'score__row': True,
    u'rank__level': True,
    u'begin_score': [
        u'begin score',
    ],
    u'end_score': [
        u'end score',
    ],
    u'begin_rank': [
        u'begin rank',
    ],
    u'end_rank': [
        u'end rank',
    ],
    u'begin_kobomatrix': [
        u'begin kobomatrix',
    ],
    u'end_kobomatrix': [
        u'end kobomatrix',
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
