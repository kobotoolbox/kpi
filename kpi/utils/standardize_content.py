from formpack.utils.replace_aliases import replace_aliases
from formpack.utils.expand_content import expand_content


def standardize_content(content):
    _content = expand_content(content)
    replace_aliases(_content, in_place=True, allowed_types={
        u'score__row': True,
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
    })
    return _content
