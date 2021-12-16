from ..actions.base import BaseAction, ACTION_NEEDED, PASSES
from ..actions.automatic_transcription import (
    AutomaticTranscriptionAction,
    REQUESTED_BY_USER,
    PENDING,
)


TEST_TRANSCRIPTION_SERVICES = [
    'acme_1_speech2text',
    'optimus_transcribers',
    'wonka_stenographers',
]


def _survey_and_submission():
    survey = {'survey': [{'type': 'audio', 'name': 'ask_a_question'}]}
    submission = {'ask_a_question': 'blah.mp3', '_attachments': [
        {'filename': 'blah.mp3',}
    ]}
    return (survey, submission)

def test_param_builder():
    AutomaticTranscriptionAction.TRANSCRIPTION_SERVICES = TEST_TRANSCRIPTION_SERVICES
    survey = _survey_and_submission()[0]
    built_params = AutomaticTranscriptionAction.build_params__valid(survey)
    assert built_params['values'] == ['ask_a_question']
    assert 'services' in built_params

def test_instantiate_action_with_params():
    survey = _survey_and_submission()[0]
    action_params = AutomaticTranscriptionAction.build_params(survey)
    action_instance = AutomaticTranscriptionAction(action_params)
    assert action_instance is not None

def test_submission_status_before_change():
    survey, submission = _survey_and_submission()
    action_params = AutomaticTranscriptionAction.build_params(survey)
    action_instance = AutomaticTranscriptionAction(action_params)

    # check that the changes ARE needed
    assert action_instance.check_submission_status(submission) == ACTION_NEEDED

    # run the change on the submission
    submission = action_instance.run_change(submission)
    # # check that the changes are NO LONGER needed
    assert action_instance.check_submission_status(submission) == PASSES

    # a user indicating they want an automatic trancription changes the value
    # in the submission._supplementalDetails from NOT_REQUESTED to REQUESTED_BY_USER
    sdeets = submission['_supplementalDetails']
    example_fs_key = [*sdeets.keys()][0]
    sdeets[example_fs_key] = REQUESTED_BY_USER
    assert action_instance.check_submission_status(submission) == ACTION_NEEDED

    submission = action_instance.run_change(submission)
    assert action_instance.check_submission_status(submission) == PASSES
    sdeets = submission['_supplementalDetails']
    example_fs_key = [*sdeets.keys()][0]
    assert sdeets[example_fs_key] == PENDING
