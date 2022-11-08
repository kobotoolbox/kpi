import math

from .base import BaseAction, ACTION_NEEDED, PASSES


def double_number(number):
    # double the number,
    # preserve the type
    cast_result_to = float
    if isinstance(number, str):
        cast_result_to = str
        number = float(number)
    elif isinstance(number, int):
        cast_result_to = int
    result = number * 2
    return cast_result_to(result)


class NumberDoubler(BaseAction):
    ID = 'number_doubler'

    def load_params(self, params):
        self.values = params['values']

    def run_change(self, submission):
        additions = submission.get(self._destination_field, {})
        for key, dest_key in self.values.items():
            original = submission.get(key)
            additions[dest_key] = double_number(original)
        return {**submission, self._destination_field: additions}

    def check_submission_status(self, submission):
        if self._destination_field not in submission:
            return ACTION_NEEDED
        values = submission[self._destination_field]
        for key, dest_key in self.values.items():
            if dest_key in values:
                return PASSES
        return ACTION_NEEDED

    @classmethod
    def build_params(kls, params, asset_content):
        numeric_questions = {}
        for row in asset_content['survey']:
            if row.get('type') in ['number', 'decimal']:
                name = row['name']
                numeric_questions[name] = f'{name}_doubled'
        params = {'values': numeric_questions}
        return params
