from ...organizations.constants import UsageType
from ..actions import ACTIONS, AUTOMATIC_TRANSCRIPTION_ACTION_IDS
from ..actions.automatic_google_transcription import AutomaticGoogleTranscriptionAction
from ..actions.automatic_transcription import BaseAutomaticTranscriptionAction
from ..actions.mixins import TranscriptionActionMixin
from ..integrations.google.google_transcribe import GoogleTranscriptionService


class FakeTranscriptionService:
    SERVICE_CODE = 'fake'


class FakeTranscriptionAction(BaseAutomaticTranscriptionAction):
    ID = 'automatic_fake_transcription'
    SERVICE_CODE = FakeTranscriptionService.SERVICE_CODE

    def get_nlp_service_class(self) -> type[FakeTranscriptionService]:
        return FakeTranscriptionService


def test_automatic_transcription_action_ids_come_from_the_base_class():
    expected_ids = [
        action.ID
        for action in ACTIONS
        if issubclass(action, TranscriptionActionMixin)
        and action.action_class_config.automatic
    ]

    assert AUTOMATIC_TRANSCRIPTION_ACTION_IDS == expected_ids
    assert AutomaticGoogleTranscriptionAction.ID in AUTOMATIC_TRANSCRIPTION_ACTION_IDS


def test_google_action_uses_its_own_service():
    action = AutomaticGoogleTranscriptionAction('q1', [{'language': 'fr'}])

    assert action.get_nlp_service_class() is GoogleTranscriptionService


def test_subclass_only_needs_an_id_and_a_service():
    params = [{'language': 'fr'}]
    google_action = AutomaticGoogleTranscriptionAction('q1', params)
    fake_action = FakeTranscriptionAction('q1', params)

    assert fake_action.get_nlp_service_class() is FakeTranscriptionService
    assert fake_action._limit_identifier == UsageType.ASR_SECONDS
    assert fake_action.action_class_config == google_action.action_class_config
    assert fake_action.allowed_source_types == google_action.allowed_source_types
    assert fake_action.result_schema == google_action.result_schema
