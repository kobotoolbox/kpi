from .actions.automatic_transcription import AutomaticTranscriptionAction

from .actions.unknown_action import UnknownAction


AVAILABLE_ACTIONS = (
    AutomaticTranscriptionAction,
)

ACTIONS_BY_ID = dict([
    (kls.ID, kls) for kls in AVAILABLE_ACTIONS
])

FEATURE_JSONSCHEMA_DESCRIPTION = (
    'PATCH or POST a matching JSON structure to a submission and it will be ' +
    'stored and processed accordingly.'
)


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


def advanced_submission_jsonschema(content, actions, url=None):
    action_instances = []
    for action_id, misc_params in actions.items():
        action_kls = ACTIONS_BY_ID[action_id]
        action_params = action_kls.build_params(content)
        action_instances.append(action_kls(action_params))
    return get_jsonschema(action_instances, url=url)

def _empty_obj():
    return {'properties': {}, 'additionalProperties': False}

def get_jsonschema(action_instances=(), url=None):
    sub_props = {}
    for instance in action_instances:
        jp = instance.jsonschema_properties
        for prop, vals in jp.items():
            sub_prop = sub_props.get(prop, _empty_obj())
            sub_prop['properties'].update(**vals)
            sub_props[prop] = sub_prop
    if url is None:
        url = '/advanced_submission_post/'
    schema = {'type': 'object',
                  '$description': FEATURE_JSONSCHEMA_DESCRIPTION,
                  'url': url,
                  'properties': {
                    'submission': {'type': 'string',
                                   'description': 'the uuid of the submission'},
                    **sub_props,
                  },
                  'additionalProperties': False,
                  'required': ['submission'],
              }
    return schema

SUPPLEMENTAL_DETAILS_KEY = '_supplementalDetails'

def stream_with_extras(submission_stream, extras):
    for submission in submission_stream:
        uuid = submission['_uuid']
        submission[SUPPLEMENTAL_DETAILS_KEY] = extras.get(uuid, {})
        yield submission
