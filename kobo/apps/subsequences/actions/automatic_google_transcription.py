from kobo.apps.organizations.constants import UsageType
from ..integrations.google.google_transcribe import GoogleTranscriptionService
from .base import ActionClassConfig, BaseAutomaticNLPAction
from .mixins import TranscriptionResultSchemaMixin

class AutomaticGoogleTranscriptionAction(
    TranscriptionResultSchemaMixin, BaseAutomaticNLPAction
):

    ID = 'automatic_google_transcription'
    action_class_config = ActionClassConfig({}, None, True)

    @property
    def result_schema(self):
        schema = super().result_schema

        # FIXME _inject_data_schema does not merge nested children
        schema['$defs']['action_status'] = {
            'action_status': {
                'type': 'string',
                'enum': ['in_progress', 'complete', 'error'],
            },
        }
        return schema

    @property
    def _limit_identifier(self):
        return UsageType.ASR_SECONDS

    def _run_automatic_process(
        self,
        submission: dict,
        submission_supplement: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | None:
        """
        Run the automatic transcription process using the Google API.

        This method is intended to be called by `revise_data()`, which will finalize
        the validation and merging of `action_data`. If the user explicitly accepts
        the last completed transcription, the method short-circuits and returns it
        immediately. If the transcription request is still in progress, the method
        returns None so that `revise_data()` can exit early and skip unnecessary
        processing. Otherwise, it calls the Google API and returns the processed
        result, ready to be passed back to `revise_data()`.
        """

        # If the client sent "accepted" while the supplement is already complete,
        # return the completed transcription right away. `revise_data()` will handle
        # the merge and final validation of this acceptance.
        accepted = action_data.get('accepted', None)
        if submission_supplement.get('status') == 'complete' and accepted is not None:
            return {
                'value': submission_supplement['value'],
                'status': 'complete',
            }

        # TBC
        if 'value' in action_data:
            return {
                'value': action_data['value'],
                'status': 'deleted',
            }

        # Otherwise, trigger the external Google transcription service.
        service = GoogleTranscriptionService(submission, asset=kwargs['asset'])
        service_data = service.process_data(self.source_question_xpath, action_data)

        # If the transcription request is still running, stop processing here.
        # Returning None ensures that `revise_data()` will not be called afterwards.
        if (
            accepted is None
            and submission_supplement.get('status')
            == service_data['status']
            == 'in_progress'
        ):
            return None

        # Normal case: return the processed transcription data.
        return service_data
