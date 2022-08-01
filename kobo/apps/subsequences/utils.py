from copy import deepcopy
from .actions.automatic_transcription import AutomaticTranscriptionAction
from .actions.translation import TranslationAction

from .actions.unknown_action import UnknownAction


AVAILABLE_ACTIONS = (
    AutomaticTranscriptionAction,
    TranslationAction,
)

ACTIONS_BY_ID = dict([
    (kls.ID, kls) for kls in AVAILABLE_ACTIONS
])

FEATURE_JSONSCHEMA_DESCRIPTION = (
    'PATCH or POST a matching JSON structure to a submission and it will be ' +
    'stored and processed accordingly.'
)

SUBMISSION_UUID_FIELD = 'meta/rootUuid'

def build_action_instances(proj_content):
    instances = []
    for action in proj_content.get('actions', []):
        action_id = action['id']
        action_instance = None
        for action_kls in AVAILABLE_ACTIONS:
            if action_kls.ID == action_id:
                action_instance = action_kls(action)
        if action_instance is None:
            action_instance = UnknownAction(params={'action_id': action_id})
        instances.append(action_instance)
    return tuple(instances)


def discern_next_stage(action_instances, submission):
    for action in action_instances:
        if not action.test_submission_passes_action(submission):
            return action

def advanced_feature_instances(content, actions):
    action_instances = []
    for action_id, action_params in actions.items():
        action_kls = ACTIONS_BY_ID[action_id]
        if action_params == True:
            action_params = action_kls.build_params({}, content)
        yield action_kls(action_params)

def populate_paths(_content):
    content = deepcopy(_content)
    group_stack = []
    for row in content['survey']:
        rowname = row.get('$autoname', row.get('name'))
        if row['type'] == 'begin_group':
            #, 'begin_repeat']:
            name = row['$autoname']
            group_stack.append(rowname)
        elif row['type'] == 'begin_repeat':
            name = row['$autoname']
            group_stack.append(f'{rowname}[]')
        elif row['type'] in ['end_group', 'end_repeat']:
            group_stack.pop()
            continue
        row['qpath'] = '-'.join([*group_stack, rowname])
    return content

def advanced_submission_jsonschema(content, actions, url=None):
    action_instances = []
    content = populate_paths(content)
    if 'translated' in actions:
        assert 'languages' in actions['translated']
    for action_id, action_params in actions.items():
        action_kls = ACTIONS_BY_ID[action_id]
        if action_params == True:
            action_params = action_kls.build_params({}, content)
        if 'values' not in action_params:
            action_params['values'] = action_kls.get_values_for_content(content)
        action_instances.append(action_kls(action_params))
    return get_jsonschema(action_instances, url=url)

def _empty_obj():
    return {'type': 'object', 'properties': {}, 'additionalProperties': False}

def get_jsonschema(action_instances=(), url=None):
    sub_props = {}
    if url is None:
        url = '/advanced_submission_post/<asset_uid>'
    schema = {'type': 'object',
                  '$description': FEATURE_JSONSCHEMA_DESCRIPTION,
                  'url': url,
                  'properties': {
                    'submission': {'type': 'string',
                                   'description': 'the uuid of the submission'},
                  },
                  'additionalProperties': False,
                  'required': ['submission'],
              }
    for instance in action_instances:
        schema = instance.modify_jsonschema(schema)
    return schema

SUPPLEMENTAL_DETAILS_KEY = '_supplementalDetails'

def stream_with_extras(submission_stream, extras):
    for submission in submission_stream:
        if SUBMISSION_UUID_FIELD in submission:
            uuid = submission[SUBMISSION_UUID_FIELD]
        else:
            uuid = submission['_uuid']
        submission[SUPPLEMENTAL_DETAILS_KEY] = extras.get(uuid, {})
        yield submission
