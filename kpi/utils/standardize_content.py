from copy import deepcopy

from formpack.utils.replace_aliases import replace_aliases
from formpack.utils.expand_content import expand_content

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
}


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
