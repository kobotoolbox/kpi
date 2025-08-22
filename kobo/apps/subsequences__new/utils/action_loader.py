from ..actions.manual_transcription import ManualTranscriptionAction
from ..type_aliases import ActionClassType

ACTION_CLASS_ID_MAPPING = {
    ManualTranscriptionAction.ID: ManualTranscriptionAction,
}

def get_action_class(post_data: dict) -> ActionClassType:
    question_xpath = next(iter(post_data))
    action_id = next(iter(post_data[question_xpath]))
    action_cls = ACTION_CLASS_ID_MAPPING[action_id]
    return question_xpath, action_cls, post_data[question_xpath][action_id]
