import json

TRANSLATIONS_EQUAL = 'equal'
TRANSLATIONS_OUT_OF_ORDER = 'out_of_order'
TRANSLATION_RENAMED = 'translation_renamed'
TRANSLATION_ADDED = 'translation_added'
TRANSLATION_CHANGE_UNSUPPORTED = 'translation_change_unsupported'
TRANSLATION_DELETED = 'translation_deleted'
TRANSLATIONS_MULTIPLE_CHANGES = 'multiple_changes'


def _track_changes(t1, t2):
    _num = 0
    params = {
        'diff_count': 0,
        'changes': []
    }
    for (i, vs) in enumerate(zip(t1, t2)):
        (v1, v2) = vs
        if v1 != v2:
            params['changes'].append({
                    'index': i,
                    'from': v1,
                    'to': v2
                })
            params['diff_count'] += 1
            _num += 1
    return params


def compare_translations(t1, t2):
    if json.dumps(t1) == json.dumps(t2):
        return {
            TRANSLATIONS_EQUAL: True,
        }
    if json.dumps(sorted(t1)) == json.dumps(sorted(t2)):
        return {
            TRANSLATIONS_OUT_OF_ORDER: True,
        }
    if len(t1) == len(t2):
        params = _track_changes(t1, t2)
        if params['diff_count'] == 1:
            return {
                TRANSLATION_RENAMED: params
            }
        elif params['diff_count'] > 1:
            return {
                TRANSLATIONS_MULTIPLE_CHANGES: params
            }
    if len(t1) == len(t2) - 1:
        _added = list(set(t2) - set(t1))
        if len(_added) == 1:
            return {
                TRANSLATION_ADDED: _added[0],
            }
    elif len(t1) == len(t2) + 1:
        _removed = list(set(t1) - set(t2))
        if len(_removed) == 1:
            return {
                TRANSLATION_DELETED: _removed[0]
            }
    return {
        TRANSLATION_CHANGE_UNSUPPORTED: True
    }
