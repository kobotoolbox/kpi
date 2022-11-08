from .base import BaseAction


class UnknownAction(BaseAction):
    ID = 'unknown_action'
    def load_params(self, params):
        action_id = params.get('action_id', '?')
        raise NotImplementedError(f'unknown action: {action_id}')
