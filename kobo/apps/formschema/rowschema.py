'''
rowschema() is a  method that returns a jsonschema customized for an individiual
row of Asset.conent['survey']
'''

import json
from copy import deepcopy


_ROWSCHEMA = {'additionalProperties': False,
 'properties': {'$kuid': {'type': 'string'},
                '__rows': {'type': 'array'},
                'appearance': {'type': 'string'},
                'audio': {'oneOf': [{'type': 'string'}, {'type': 'object'}]},
                'auto_delete': {'type': 'string'},
                'bind': {'oneOf': [{'type': 'string'}, {'type': 'object'}]},
                'bind::foo': {'type': 'string'},
                'calculate': {'type': 'string'},
                'calculation': {'type': 'string'},
                'choice_filter': {'type': 'string'},
                'compact_tag': {'type': 'string'},
                'constraint': {'type': 'string'},
                'constraint_message': {'type': 'string'},
                'default': {'oneOf': [{'type': 'string'}, {'type': 'number'}]},
                'guidance_hint': {'oneOf': [{'type': 'string'},
                                            {'type': 'object'}]},
                'hint': {'oneOf': [{'type': 'string'}, {'type': 'object'}]},
                'image': {'type': 'string'},
                'intent': {'type': 'string'},
                'label': {'oneOf': [{'type': 'string'}, {'type': 'object'}]},
                'name': {'type': 'string'},
                'parameters': {'type': 'string'},
                'params': {'type': 'object'},
                'read_only': {'oneOf': [{'type': 'string'},
                                        {'type': 'boolean'}]},
                'relevant': {'type': 'string'},
                'required': {'oneOf': [{'type': 'string'},
                                       {'type': 'boolean'}]},
                'select_from': {'type': 'string'},
                'select_from_file': {'type': 'string'},
                'type': {'type': 'string'},
                'type__list_name': {'type': 'string'},
                'value': {'type': 'string'}},
 'type': 'object'}


def rowschema(available_types=None, extra_properties=None):
    _types = {'type': 'string'}
    _rowschema = deepcopy(_ROWSCHEMA)
    if available_types is None:
        available_types = []
    if extra_properties is None:
        extra_properties = {}
    for _ep in extra_properties:
        _rowschema['properties'].update(extra_properties)
    else:
        _types['enum'] = available_types
    _rowschema['properties']['type'] = _types
    # import pdb; pdb.set_trace()
    return _rowschema

AVAIL_TYPES = [
    'today',
    'audit',
    'barcode',
    'audio',
    'begin_repeat',
    'end_repeat',
    'media::image',
    'acknowledge',
    'username',
    'simserial',
    'subscriberid',
    'deviceid',
    'phonenumber',
    'start',
    'end',
    'begin_group',
    'end_group',
    'begin_kobomatrix',
    'begin_score',
    'begin_rank',
    'end_rank',
    'rank__level',
    'score__row',
    'end_score',
    'calculate',
    'date',
    'datetime',
    'decimal',
    'end',
    'end_kobomatrix',
    'file',
    'filterType',
    'geopoint',
    'geoshape',
    'geotrace',
    'image',
    'int',
    'integer',
    'note',
    'osm',
    'osm_buildingtags',
    'range',
    'select_multiple',
    'select_multiple_from_file',
    'select_one',
    'select_one_external',
    'select_one_from_file',
    'start',
    'string',
    'text',
    'time',
    'xml-external',
]

ROWSCHEMA = rowschema(available_types=AVAIL_TYPES,
                      extra_properties={
  'kobo--score-choices': {
    'type': 'string',
  },
  '$autoname': {
    'type': 'string',
  },
  '$given_name': {
    'type': 'string',
  },
  'block': {
    'type': 'string',
  }
})
