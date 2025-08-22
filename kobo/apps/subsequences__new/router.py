from kobo.apps.subsequences.models import (
    SubmissionExtras,  # just bullshit for now
)

from .actions import ACTION_IDS_TO_CLASSES


class InvalidAction(Exception):
    """
    The referenced action does not exist or was not configured for the given
    question XPath at the asset level
    """

    pass


class InvalidXPath(Exception):
    """
    The referenced question XPath was not configured for supplemental data at
    the asset level
    """

    pass


def handle_incoming_data(asset, data):
    schema_version = data.pop('_version')
    if schema_version != '20250820':
        # TODO: migrate from old per-submission schema
        raise NotImplementedError

    submission_uuid = data.pop('_submission')  # not needed in POST data bc of nested endpoint
    supplemental_data = SubmissionExtras.objects.get_or_create(
        asset=asset, submission_uuid=submission_uuid
    )[0].content  # lock it?

    for question_xpath, data_for_this_question in data.items():
        if asset.advanced_features['_version'] != '20250820':
            # TODO: migrate from old per-asset schema
            raise NotImplementedError
        try:
            action_configs_for_this_question = asset.advanced_features[
                '_schema'
            ][question_xpath]
        except KeyError as e:
            raise InvalidXPath from e

        for action_id, action_data in data_for_this_question.items():
            try:
                action_class = ACTION_IDS_TO_CLASSES[action_id]
            except KeyError as e:
                raise InvalidAction from e
            try:
                action_params = action_configs_for_this_question[action_id]
            except KeyError as e:
                raise InvalidAction from e

            action = action_class(question_xpath, action_params)
            # action.validate_data(action_data)  # called by revise_field
            supplemental_data = action.revise_field(supplemental_data, action_data)

    SubmissionExtras.objects.filter(
        asset=asset, submission_uuid=submission_uuid
    ).update(content=supplemental_data)
