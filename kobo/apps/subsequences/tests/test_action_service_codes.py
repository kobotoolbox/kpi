from ..actions import (
    TRANSCRIPTION_ACTION_IDS_BY_SERVICE_CODE,
    TRANSLATION_ACTION_IDS_BY_SERVICE_CODE,
)


def test_transcription_action_ids_by_service_code():
    assert TRANSCRIPTION_ACTION_IDS_BY_SERVICE_CODE == {
        'goog': 'automatic_google_transcription'
    }


def test_translation_action_ids_by_service_code():
    assert TRANSLATION_ACTION_IDS_BY_SERVICE_CODE == {
        'goog': 'automatic_google_translation'
    }
