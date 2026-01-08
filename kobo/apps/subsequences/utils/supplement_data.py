from typing import Generator

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kobo.apps.subsequences.constants import (
    SUBMISSION_UUID_FIELD,
    SUPPLEMENT_KEY,
    Action,
)
from kobo.apps.subsequences.models import SubmissionSupplement


def get_analysis_form_json(asset: 'kpi.models.Asset') -> list[dict]:
    """
    these are the fields added to exports, displayed in the table view, etc.

    multiple actions could result in only a single field, such as a manual
    transcript and an automatic transcript for a given language only resulting
    in one field in the output data

    Returns a list of fields contributed by all enabled actions (at the asset
    level) to outputted submission data as shown in exports, the table view UI,
    etc.

    Consider transcribing `group_name/question_name` into French, both manually
    and automatically. The output fields need to contain only *one* unified
    field for the French transcript:
        [
            {
                'language': 'fr',
                'name': 'group_name/question_name/transcript_fr',
                'source': 'group_name/question_name',
                'type': 'transcript',
            }
        ]

    When it's time to get the data, we'll have to arbitrate between the manual
    and automatic transcripts if both are ever present for a particular
    submission. We'll do that by looking at the acceptance dates and letting
    the most recent win
    """

    additional_fields_by_action_id = {
        # The order of this dictionary governs how fields are sorted in the
        # list to be returned. Grouping fields together with their sources is
        # handled by logic elsewhere
        Action.MANUAL_TRANSCRIPTION: [],
        Action.AUTOMATIC_GOOGLE_TRANSCRIPTION: [],
        Action.MANUAL_TRANSLATION: [],
        Action.AUTOMATIC_GOOGLE_TRANSLATION: [],
        Action.MANUAL_QUAL: [],
        Action.AUTOMATIC_BEDROCK_QUAL: [],
    }

    dt_paths_seen = set()
    for advanced_feature in asset.advanced_features_set.all():
        action = advanced_feature.to_action()
        output_fields = action.get_output_fields()
        for field in output_fields:
            if field['dtpath'] in dt_paths_seen:
                continue
            additional_fields_by_action_id[action.ID].append(field)
            dt_paths_seen.add(field['dtpath'])

    additional_fields_sorted = []
    for fields_for_action in additional_fields_by_action_id.values():
        # Yay, dictionaries retain their order nowadays
        additional_fields_sorted.extend(fields_for_action)

    return additional_fields_sorted


def stream_with_supplements(
    asset: 'kpi.models.Asset', submission_stream: Generator, for_output: bool = False
) -> Generator:
    if not asset.advanced_features_set.exists():
        yield from submission_stream
        return

    # FIXME: eww, this is bad, but maybe better than one query per submission?
    # Probably need to go up a few generators and grab an entire page of
    # submissions and supplements, then yield each of those, and grab again from
    # the database only once the page is exhausted

    # 2025-08-24: oleger's comment: we could narrow down this query to submissions
    # only available in the page (`page` as in pagination). No need to retrieve data for
    # all submissions if we are only injecting supplement data for a portion of
    # them. Question? How we do that without consuming the mongo cursor twice?
    extras = dict(
        SubmissionSupplement.objects.filter(asset=asset).values_list(
            'submission_uuid', 'content'
        )
    )

    for submission in submission_stream:
        submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])
        submission[SUPPLEMENT_KEY] = SubmissionSupplement.retrieve_data(
            asset,
            for_output=for_output,
            prefetched_supplement=extras.get(submission_uuid, {}),
        )
        yield submission
