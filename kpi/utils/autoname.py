import re
import string
import random
import json
from copy import deepcopy
from collections import OrderedDict

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


def autoname_fields_to_field(surv_content, in_place=False, to_field='$autoname'):
    if in_place:
        autoname_fields_in_place(surv_content, destination_key=to_field)
    else:
        _content_copy = deepcopy(surv_content)
        autoname_fields_in_place(_content_copy, destination_key=to_field)
        return _content_copy


def autoname_fields(surv_content, in_place=False):
    if in_place:
        autoname_fields_in_place(surv_content, destination_key='name')
    else:
        _content_copy = deepcopy(surv_content)
        autoname_fields_in_place(_content_copy, destination_key='name')
        return _content_copy.get('survey')


def autoname_fields_in_place(surv_content, destination_key):
    surv_list = surv_content.get('survey')
    other_names = OrderedDict()

    def _assign_row_to_name(row, suggested_name):
        if suggested_name in other_names:
            raise ValueError('Duplicate name error: {}'.format(suggested_name))
        other_names[suggested_name] = row
        row[destination_key] = suggested_name

    # rows_needing_names is all rows needing a valid and unique name
    # end_group, etc. do not need valid names
    rows_needing_names = filter(lambda r: not _is_group_end(r), surv_list)

    # cycle through existing names ane ensure that names are valid and unique
    for row in filter(lambda r: _has_name(r), rows_needing_names):
        _name = row['name']
        while (not is_valid_nodeName(_name) or _name in other_names):
            _name = sluggify_label(_name, other_names=other_names.keys())
        _assign_row_to_name(row, _name)

    for row in filter(lambda r: not _has_name(r), rows_needing_names):
        if 'label' in row:
            if isinstance(row['label'], list):
                _label = next((l for l in row['label'] if l), None)
            else:
                _label = row['label']
            if _label:
                _name = sluggify_label(_label, other_names=other_names.keys())
                _assign_row_to_name(row, _name)
                continue

        # if no labels can be used, then use a combination of type (which is
        # always available) and kuid, which should always be unique
        _slug = row['type']
        if '$kuid' in row:
            _slug += ('_' + row['$kuid'])
        _assign_row_to_name(row, sluggify_label(_slug, other_names.keys()))

    assert len(other_names) == len(rows_needing_names)
    return surv_list


def sluggify_valid_xml__depr(name):
    out = re.sub('\W+', '_', name.strip().lower())
    if re.match(r'^\d', out):
        out = '_'+out
    return out


def autovalue_choices(surv_choices, in_place=False):
    if in_place:
        autovalue_choices_in_place(surv_choices, 'name')
    else:
        _content = deepcopy(surv_choices)
        autovalue_choices_in_place(_content, 'name')
        return _content


def autovalue_choices_in_place(surv_content, destination_key, ensure_unique=True):
    surv_choices = surv_content.get('choices', [])
    for choice in surv_choices:
        # this has to change to prevent spaces in choice values (see kpi#960)
        if 'name' not in choice:
            choice['name'] = choice['label']

        if 'list name' in choice:
            raise ValueError('Error: standardized asset content needed')
