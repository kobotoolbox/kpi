import re
import string
import random
import json

from kpi.utils.sluggify import sluggify_label, is_valid_nodeName


def _increment(name):
    return name + '_0'


def _rand_id(n):
    return ''.join(random.choice(string.ascii_uppercase + string.digits)
                   for _ in range(n))


def _has_name(row):
    return 'name' in row and row['name'] != ''


def _is_group_end(row):
    row_type = row['type']
    return isinstance(row_type, basestring) and \
        (row_type.startswith('end ') or row_type.startswith('end_'))


def autoname_fields__depr(surv_content):
    '''
    Note: this method is deprecated but kept around to link prior deployments
    which don't have any names saved.
    '''
    surv_list = surv_content.get('survey')
    kuid_names = {}
    for surv_row in surv_list:
        if not _has_name(surv_row):
            if _is_group_end(surv_row):
                continue
            if 'label' in surv_row:
                next_name = sluggify_valid_xml__depr(surv_row['label'])
            else:
                raise ValueError('Label cannot be translated: %s' %
                                 json.dumps(surv_row))
            while next_name in kuid_names.values():
                next_name = _increment(next_name)
            if 'kuid' not in surv_row:
                surv_row['kuid'] = _rand_id(8)
            if surv_row['kuid'] in kuid_names:
                raise Exception("Duplicate kuid: %s" % surv_row['kuid'])
            surv_row['name'] = next_name
            kuid_names[surv_row['kuid']] = next_name
    # kuid is unused, and can't be compared with replacement method
    for surv_row in surv_list:
        if 'kuid' in surv_row:
            del surv_row['kuid']
    return surv_list


def autoname_fields(surv_content):
    surv_list = surv_content.get('survey')
    other_names = []

    # cycle through existing names ane ensure that names are valid and unique
    rows_with_names = filter(lambda r: _has_name(r) and not _is_group_end(r),
                             surv_list)
    for row in rows_with_names:
        _name = row['name']
        while (not is_valid_nodeName(_name) or _name in other_names):
            _name = sluggify_label(_name, other_names=other_names)
        other_names.append(_name)
        row['name'] = _name

    rows_without_names = filter(lambda r: not _has_name(r) and
                                not _is_group_end(r),
                                surv_list)
    for row in rows_without_names:
        if not _has_name(row) and not _is_group_end(row):
            if 'label' in row:
                _name = sluggify_label(row['label'], other_names=other_names)
                other_names.append(_name)
                row['name'] = _name
                continue

            labelly_keys = filter(lambda k: k.startswith('label'), row.keys())
            if len(labelly_keys) > 0:
                _name = sluggify_label(labelly_keys[0], other_names)
            else:
                _name = sluggify_label(row['type'], other_names)
            other_names.append(_name)
            row['name'] = _name
    return surv_list


def sluggify_valid_xml__depr(name):
    out = re.sub('\W+', '_', name.strip().lower())
    if re.match(r'^\d', out):
        out = '_'+out
    return out


def autovalue_choices(surv_choices):
    for choice in surv_choices:
        if 'name' not in choice:
            choice['name'] = choice['label']
        # workaround for incorrect "list_name" column header (was missing _)
        if 'list name' in choice:
            choice['list_name'] = choice['list name']
            del choice['list name']
    return surv_choices
