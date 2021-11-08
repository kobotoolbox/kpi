from .actions.automatic_transcription import AutomaticTranscriptionAction

from .actions.unknown_action import UnknownAction


AVAILABLE_ACTIONS = (
    AutomaticTranscriptionAction,
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
