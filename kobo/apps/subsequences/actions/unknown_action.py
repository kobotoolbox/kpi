from .base import BaseAction


class UnknownAction(BaseAction):
    ID = 'unknown_action'
    def load_params(self, params):
        action_id = params.get('action_id', '?')
        raise Exception(f'uknown action: {action_id}')
