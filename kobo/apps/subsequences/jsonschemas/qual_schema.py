'''
This script is a proof-of-concept python file that generates
a jsonschema snippet with comments attempting to explain the decisions
that went into the parts of the schema.
'''
def refdefpath(ss):
    return {'$ref': f'#/definitions/{ss}'}

DEFINITIONS = {}

# Every entry in the "qual" section has a "type" and a "uuid"
# and must match this jsonschema
DEFINITIONS['qual_base'] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'uuid': {'type': 'string'},
        'type': {'type': 'string'},
        'val': {},
    },
    'required': ['uuid', 'type', 'val'],
}

# a DEFINITION is set for each of these types:
#  - qual_tags
#  - qual_text
#  - qual_integer
#  - qual_select_one
#  - qual_select_multiple
# including "const": "qual_{type}"

DEFINITIONS['qual_tags'] = {
    'type': 'object',
    'properties': {
        'val': {
            'type': 'array',
            'items': {'type': 'string'},
        },
        'type': {'const': 'qual_tags'},
    },
}
DEFINITIONS['qual_text'] = {
    'type': 'object',
    'properties': {
        'type': {'const': 'qual_text'},
        'val': {
            'type': 'string',
        },
    },
}
DEFINITIONS['qual_integer'] = {
    'type': 'object',
    'properties': {
        'type': {'const': 'qual_integer'},
        'val': {'type': ['integer', 'null']},
    },
}
DEFINITIONS['qual_select_one'] = {
    'type': 'object',
    'properties': {
        'type': {'const': 'qual_select_one'},
        'val': {'type': 'string', 'minLength': 1},
    },
}
DEFINITIONS['qual_select_multiple'] = {
    'type': 'object',
    'properties': {
        'type': {'const': 'qual_select_multiple'},
        'val': {
            'type': 'array',
            'items': {'type': 'string', 'minLength': 1},
        },
    },
}

# It is all held together by the common "qual_item" definition
DEFINITIONS['qual_item'] = {
    # so a properly formatted entry to the qual list matches
    # at least ONE of these:
    'anyOf': [refdefpath(_typ) for _typ in [
        'qual_tags',
        'qual_text',
        'qual_integer',
        'qual_select_one',
        'qual_select_multiple',
    ]],
    # and must match "qual_base"
    'allOf': [refdefpath('qual_base')],
}

def array_items():
    '''
    This schema snippet simply ensures that each item in an array are structured like
    a valid qual_item
    '''
    return {
        'type': 'array',
        'items': refdefpath('qual_item'),
    }
