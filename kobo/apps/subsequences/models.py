from django.db import models

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kpi.models.abstract_models import AbstractTimeStampedModel
from .actions import ACTION_IDS_TO_CLASSES
from .exceptions import InvalidAction, InvalidXPath
from .schemas import validate_submission_supplement


class SubmissionExtras(AbstractTimeStampedModel):
    # TODO: trash this and rename the model
    submission_uuid = models.CharField(max_length=249)
    content = models.JSONField(default=dict)
    asset = models.ForeignKey(
        'kpi.Asset',
        related_name='submission_extras',
        on_delete=models.CASCADE,
    )

    class Meta:
        # ideally `submission_uuid` is universally unique, but its uniqueness
        # per-asset is most important
        unique_together = (('asset', 'submission_uuid'),)


class SubmissionSupplement(SubmissionExtras):
    class Meta(SubmissionExtras.Meta):
        proxy = True

    def __repr__(self):
        return f'Supplement for submission {self.submission_uuid}'

    @staticmethod
    def revise_data(asset: 'kpi.Asset', submission: dict, incoming_data: dict) -> dict:
        schema_version = incoming_data.get('_version')
        if schema_version != '20250820':
            # TODO: migrate from old per-submission schema
            raise NotImplementedError

        if asset.advanced_features['_version'] != schema_version:
            # TODO: migrate from old per-asset schema
            raise NotImplementedError

        submission_uuid = submission['meta/rootUuid']  # constant?
        supplemental_data = SubmissionExtras.objects.get_or_create(
            asset=asset, submission_uuid=submission_uuid
        )[
            0
        ].content  # lock it?

        retrieved_supplemental_data = {}

        for question_xpath, data_for_this_question in incoming_data.items():
            if question_xpath == '_version':
                # FIXME: what's a better way? skip all leading underscore keys?
                # pop off the known special keys first?
                continue
            try:
                action_configs_for_this_question = asset.advanced_features[
                    '_actionConfigs'
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
                action.check_limits(asset.owner)
                question_supplemental_data = supplemental_data.setdefault(
                    question_xpath, {}
                )
                default_action_supplemental_data = (
                    {}
                    if action.item_reference_property is None
                    else []
                )
                action_supplemental_data = question_supplemental_data.setdefault(
                    action_id, default_action_supplemental_data
                )
                action_supplemental_data = action.revise_data(
                    submission, action_supplemental_data, action_data
                )
                question_supplemental_data[action_id] = action_supplemental_data
                retrieved_supplemental_data.setdefault(question_xpath, {})[
                    action_id
                ] = action.retrieve_data(action_supplemental_data)

        supplemental_data['_version'] = schema_version
        validate_submission_supplement(asset, supplemental_data)
        SubmissionExtras.objects.filter(
            asset=asset, submission_uuid=submission_uuid
        ).update(content=supplemental_data)

        # FIXME: bug! this will not return data from the other actions (and
        # questions?) that were not affected by the revision
        retrieved_supplemental_data['_version'] = schema_version
        return retrieved_supplemental_data

    @staticmethod
    def retrieve_data(
        asset: 'kpi.Asset',
        submission_root_uuid: str | None = None,
        prefetched_supplement: dict | None = None,
    ) -> dict:
        if (submission_root_uuid is None) == (prefetched_supplement is None):
            raise ValueError(
                'Specify either `submission_root_uuid` or `prefetched_supplement`'
            )

        if submission_root_uuid:
            submission_uuid = remove_uuid_prefix(submission_root_uuid)
            try:
                supplemental_data = SubmissionExtras.objects.get(
                    asset=asset, submission_uuid=submission_uuid
                ).content
            except SubmissionExtras.DoesNotExist:
                supplemental_data = None
        else:
            supplemental_data = prefetched_supplement

        if not supplemental_data:
            return {}

        schema_version = supplemental_data.pop('_version')
        if schema_version != '20250820':
            # TODO: migrate from old per-submission schema
            raise NotImplementedError

        if asset.advanced_features['_version'] != schema_version:
            # TODO: migrate from old per-asset schema
            raise NotImplementedError

        retrieved_supplemental_data = {}

        for question_xpath, data_for_this_question in supplemental_data.items():
            processed_data_for_this_question = retrieved_supplemental_data.setdefault(
                question_xpath, {}
            )
            action_configs = asset.advanced_features['_actionConfigs']
            try:
                action_configs_for_this_question = action_configs[question_xpath]
            except KeyError:
                # There's still supplemental data for this question at the
                # submission level, but the question is no longer configured at the
                # asset level.
                # Allow this for now, but maybe forbid later and also forbid
                # removing things from the asset-level action configuration?
                # Actions could be disabled or hidden instead of being removed

                # FIXME: divergence between the asset-level configuration and
                # submission-level supplemental data is going to cause schema
                # validation failures! We defo need to forbid removal of actions
                # and instead provide a way to mark them as deleted
                continue

            for action_id, action_data in data_for_this_question.items():
                try:
                    action_class = ACTION_IDS_TO_CLASSES[action_id]
                except KeyError:
                    # An action class present in the submission data no longer
                    # exists in the application code
                    # TODO: log an error
                    continue
                try:
                    action_params = action_configs_for_this_question[action_id]
                except KeyError:
                    # An action class present in the submission data is no longer
                    # configured at the asset level for this question
                    # Allow this for now, but maybe forbid later and also forbid
                    # removing things from the asset-level action configuration?
                    # Actions could be disabled or hidden instead of being removed
                    continue

                action = action_class(question_xpath, action_params)
                processed_data_for_this_question[action_id] = action.retrieve_data(
                    action_data
                )

        retrieved_supplemental_data['_version'] = schema_version
        return retrieved_supplemental_data
