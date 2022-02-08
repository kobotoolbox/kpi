from ..actions.base import BaseAction, ACTION_NEEDED, PASSES
from ..actions.number_doubler import NumberDoubler


def _survey_and_submission_with_numerics():
    survey = {'survey': [
              {'type': 'number', 'name': 'num1'},
              {'type': 'number', 'name': 'num2'},
              {'type': 'decimal', 'name': 'num3'},
              {'type': 'decimal', 'name': 'num4'},
              ]}
    submission = {'num1': '2', 'num2': 3, 'num3': '0.5', 'num4': 1.5}
    return (survey, submission)

def test_param_builder():
    survey = _survey_and_submission_with_numerics()[0]
    built_params = NumberDoubler.build_params({}, survey)
    assert 'values' in built_params
    # assert built_params['values']['num1'] == 'num1_doubled'
    assert [*built_params['values'].keys()] == ['num1', 'num2', 'num3', 'num4']
    assert [*built_params['values'].values()] == ['num1_doubled', 'num2_doubled',
                                                  'num3_doubled', 'num4_doubled']


def test_instantiate_action_with_params():
    survey = _survey_and_submission_with_numerics()[0]
    action_params = NumberDoubler.build_params({}, survey)
    action_instance = NumberDoubler(action_params)
    assert action_instance is not None

def test_submission_status_before_and_after_change():
    survey, submission = _survey_and_submission_with_numerics()
    action_params = NumberDoubler.build_params({}, survey)
    action_instance = NumberDoubler(action_params)

    # check that the changes ARE needed
    STATUS_BEFORE_CHANGE = action_instance.check_submission_status(submission)
    assert STATUS_BEFORE_CHANGE == ACTION_NEEDED

    # run the change on the submission
    submission = action_instance.run_change(submission)

    # check that the changes are NO LONGER needed
    STATUS_AFTER_CHANGE = action_instance.check_submission_status(submission)
    assert STATUS_AFTER_CHANGE == PASSES
