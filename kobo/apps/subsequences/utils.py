from typing import Generator

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from .actions import ACTION_IDS_TO_CLASSES
from .constants import SUBMISSION_UUID_FIELD, SUPPLEMENT_KEY
from .models import SubmissionSupplement


def get_supplemental_output_fields(asset: 'kpi.models.Asset') -> list[dict]:
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
    advanced_features = asset.advanced_features

    if advanced_features.get('_version') != '20250820':
        # TODO: add a migration to update the schema version
        raise NotImplementedError()

    output_fields_by_name = {}
    # FIXME: `_actionConfigs` is 👎 and should be dropped in favor of top-level configs, eh?
    # data already exists at the top level alongisde leading-underscore metadata like _version
    for source_question_xpath, per_question_actions in advanced_features[
        '_actionConfigs'
    ].items():
        for action_id, action_config in per_question_actions.items():
            action = ACTION_IDS_TO_CLASSES[action_id](
                source_question_xpath, action_config
            )
            for field in action.get_output_fields():
                try:
                    existing = output_fields_by_name[field['name']]
                except KeyError:
                    output_fields_by_name[field['name']] = field
                else:
                    # It's normal for multiple actions to contribute the same
                    # field, but they'd better be exactly the same!
                    assert field == existing

    # since we want transcripts always to come before translations, à la
    #    <source field> <transcript fr> <translation en> <translation es>
    # and we're lucky with alphabetical order, we can just sort by name
    return sorted(
        output_fields_by_name.values(), key=lambda field: field['name']
    )


def stream_with_supplements(
    asset: 'kpi.models.Asset',
    submission_stream: Generator,
    for_output: bool = False
) -> Generator:
    if not asset.advanced_features:
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
            asset, for_output=for_output, prefetched_supplement=extras.get(submission_uuid, {})
        )
        yield submission
