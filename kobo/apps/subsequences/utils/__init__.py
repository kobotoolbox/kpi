from collections import defaultdict
from copy import deepcopy

from ..actions.automatic_transcription import AutomaticTranscriptionAction
from ..actions.qual import QualAction
from ..actions.translation import TranslationAction
from .deprecation import get_sanitized_advanced_features, get_sanitized_dict_keys

AVAILABLE_ACTIONS = (
    AutomaticTranscriptionAction,
    TranslationAction,
    QualAction,
)

ACTIONS_BY_ID = dict([
    (kls.ID, kls) for kls in AVAILABLE_ACTIONS
])

FEATURE_JSONSCHEMA_DESCRIPTION = (
    'PATCH or POST a matching JSON structure to a submission and it will be ' +
    'stored and processed accordingly.'
)

SUBMISSION_UUID_FIELD = 'meta/rootUuid'

# def build_action_instances(proj_content):
#     instances = []
#     for action in proj_content.get('actions', []):
#         action_id = action['id']
#         action_instance = None
#         for action_kls in AVAILABLE_ACTIONS:
#             if action_kls.ID == action_id:
#                 action_instance = action_kls(action)
#         if action_instance is None:
#             action_instance = UnknownAction(params={'action_id': action_id})
#         instances.append(action_instance)
#     return tuple(instances)

# def discern_next_stage(action_instances, submission):
#     for action in action_instances:
#         if not action.test_submission_passes_action(submission):
#             return action


def advanced_feature_instances(content, actions):
    for action_id, action_params in actions.items():
        action_kls = ACTIONS_BY_ID[action_id]
        if action_params is True:
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

        # HOTFIX 2022-12-06
        if rowname is None:
            rowname = 'missingrowname'
            import logging
            logging.error('missing row name', extra={'path': group_stack})
        # /HOTFIX 2022-12-06

        row['xpath'] = '/'.join([*group_stack, rowname])
    return content


def advanced_submission_jsonschema(content, actions, url=None):
    actions = deepcopy(actions)
    action_instances = []
    content = populate_paths(content)
    # devhack: this keeps serializer from breaking when old params
    # are still in the database
    if 'translated' in actions:  # migration
        actions['translation'] = actions['translated']  # migration
        assert 'languages' in actions['translation']
        del actions['translated']  # migration
    # /devhack

    for action_id, action_params in actions.items():
        action_kls = ACTIONS_BY_ID[action_id]
        if action_params is True:
            action_params = action_kls.build_params({}, content)
        if 'values' not in action_params:
            action_params['values'] = action_kls.get_values_for_content(content)
        action_instances.append(action_kls(action_params))
    return get_jsonschema(action_instances, url=url)

# def _empty_obj():
#     return {'type': 'object', 'properties': {}, 'additionalProperties': False}


def get_jsonschema(action_instances=(), url=None):
    sub_props = {}
    if url is None:
        url = '/advanced_submission_post/<asset_uid>'
    schema = {
        'type': 'object',
        '$description': FEATURE_JSONSCHEMA_DESCRIPTION,
        'url': url,
        'properties': {
            'submission': {
                'type': 'string',
                'description': 'the uuid of the submission',
            },
        },
        'additionalProperties': False,
        'required': ['submission'],
    }
    for instance in action_instances:
        schema = instance.modify_jsonschema(schema)
    return schema


SUPPLEMENTAL_DETAILS_KEY = '_supplementalDetails'


def stream_with_extras(submission_stream, asset):
    extras = dict(
        asset.submission_extras.values_list('submission_uuid', 'content')
    )

    if asset.advanced_features and (
        advanced_features := get_sanitized_advanced_features(asset)
    ):
        asset.advanced_features = advanced_features

    try:
        qual_survey = asset.advanced_features['qual']['qual_survey']
    except KeyError:
        qual_survey = []
    else:
        qual_survey = deepcopy(qual_survey)

    # keys are question UUIDs, values are question definitions
    qual_questions_by_uuid = {}
    # outer keys are question UUIDs, inner keys are choice UUIDs, values are
    # choice definitions
    qual_choices_per_question_by_uuid = defaultdict(dict)
    for qual_q in qual_survey:
        try:
            choices = qual_q['choices']
        except KeyError:
            pass
        else:
            qual_choices_per_question_by_uuid[qual_q['uuid']] = {
                c['uuid']: c for c in choices
            }
        qual_questions_by_uuid[qual_q['uuid']] = qual_q

    for submission in submission_stream:
        if SUBMISSION_UUID_FIELD in submission:
            uuid = submission[SUBMISSION_UUID_FIELD]
        else:
            uuid = submission['_uuid']

        all_supplemental_details = deepcopy(extras.get(uuid, {}))
        for supplemental_details in all_supplemental_details.values():
            try:
                all_qual_responses = supplemental_details['qual']
            except KeyError:
                continue
            for qual_response in all_qual_responses:
                try:
                    qual_q = qual_questions_by_uuid[qual_response['uuid']]
                except KeyError:
                    # TODO: make sure this can never happen by refusing to
                    # remove qualitative analysis questions once added. They
                    # should simply be hidden
                    qual_response['error'] = 'unknown question'
                    continue
                qual_q = deepcopy(qual_q)
                choices = qual_q.pop('choices', None)
                if choices:
                    val = qual_response['val']
                    if isinstance(val, list):
                        single_choice = False
                    else:
                        single_choice = True
                        val = [val]
                    val_expanded = []
                    for v in val:
                        if v == '':
                            continue
                        try:
                            v_ex = qual_choices_per_question_by_uuid[
                                qual_q['uuid']
                            ][v]
                        except KeyError:
                            # TODO: make sure this can never happen by refusing
                            # to remove qualitative analysis *choices* once
                            # added. They should simply be hidden
                            v_ex = {'uuid': v, 'error': 'unknown choice'}
                        val_expanded.append(v_ex)
                    if single_choice and val_expanded:
                        val_expanded = val_expanded[0]
                    qual_response['val'] = val_expanded
                qual_response.update(qual_q)

        # Remove `qpath` if present
        if sanitized_suppl_details := get_sanitized_dict_keys(
            all_supplemental_details, asset
        ):
            all_supplemental_details = sanitized_suppl_details

        submission[SUPPLEMENTAL_DETAILS_KEY] = all_supplemental_details

        yield submission
