from django.db import models

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kpi.fields import KpiUidField, LazyDefaultJSONBField
from kpi.models.abstract_models import AbstractTimeStampedModel
from .actions import ACTION_IDS_TO_CLASSES
from .constants import SCHEMA_VERSIONS, SUBMISSION_UUID_FIELD, Action
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

        if not asset.advanced_features or not asset.advanced_features.get(
            '_actionConfigs'
        ):
            raise InvalidAction

        schema_version = incoming_data.get('_version')

        if schema_version not in SCHEMA_VERSIONS:
            # TODO: raise error. Unknown version
            raise NotImplementedError

        if schema_version != SCHEMA_VERSIONS[0]:
            # TODO: migrate from old per-submission schema
            raise NotImplementedError

        if asset.advanced_features.get('_version') != schema_version:
            # TODO: migrate from old per-asset schema
            raise NotImplementedError

        submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])  # constant?
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

                action = action_class(question_xpath, action_params, asset)
                action.check_limits(asset.owner)

                question_supplemental_data = supplemental_data.setdefault(
                    question_xpath, {}
                )
                action_supplemental_data = question_supplemental_data.setdefault(
                    action_id, {}
                )
                action.get_action_dependencies(question_supplemental_data)
                if not (
                    action_supplemental_data := action.revise_data(
                        submission,
                        action_supplemental_data,
                        action_data,
                    )
                ):
                    # TODO is line below really needed?
                    supplemental_data['_version'] = schema_version
                    return supplemental_data

                question_supplemental_data[action_id] = action_supplemental_data

                # 2025-09-24 oleger: What are the 3 lines below for?
                #retrieved_supplemental_data.setdefault(question_xpath, {})[
                #    action_id
                #] = action.retrieve_data(action_supplemental_data)

        supplemental_data['_version'] = schema_version
        validate_submission_supplement(asset, supplemental_data)
        SubmissionExtras.objects.filter(
            asset=asset, submission_uuid=submission_uuid
        ).update(content=supplemental_data)

        return supplemental_data

    @staticmethod
    def retrieve_data(
        asset: 'kpi.Asset',
        submission_root_uuid: str | None = None,
        prefetched_supplement: dict | None = None,
        for_output: bool = False,
    ) -> dict | list[dict]:
        """
        `for_output = True` returns a flattened and simplified list of columns
        (field names) and values contributed by each enabled action, for use in
        exports and the like. Where multiple actions attempt to provide the
        same column, the most recently accepted action result is used as the
        value
        """
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

        if schema_version not in SCHEMA_VERSIONS:
            # TODO: raise error. Unknown version
            raise NotImplementedError

        if schema_version != SCHEMA_VERSIONS[0]:
            # TODO: migrate from old per-submission schema
            raise NotImplementedError

        if asset.advanced_features.get('_version') != schema_version:
            # TODO: migrate from old per-asset schema
            raise NotImplementedError

        retrieved_supplemental_data = {}
        data_for_output = {}

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

                retrieved_data = action.retrieve_data(action_data)
                processed_data_for_this_question[action_id] = retrieved_data
                if for_output:
                    # Arbitrate the output data so that each column is only
                    # represented once, and that the most recently accepted
                    # action result is used as the value
                    transformed_data = action.transform_data_for_output(retrieved_data)
                    for field_name, field_data in transformed_data.items():
                        # Omit `_dateAccepted` from the output data
                        new_acceptance_date = field_data.pop('_dateAccepted', None)
                        if not new_acceptance_date:
                            # Never return unaccepted data
                            continue
                        existing_acceptance_date = data_for_output.get(
                            field_name, {}
                        ).get('_dateAccepted')
                        if (
                            not existing_acceptance_date
                            or existing_acceptance_date < new_acceptance_date
                        ):
                            data_for_output[field_name] = field_data

        retrieved_supplemental_data['_version'] = schema_version

        if for_output:
            return data_for_output

        return retrieved_supplemental_data


class QuestionAdvancedFeature(models.Model):
    uid = KpiUidField(uid_prefix='qaf', primary_key=True)
    asset = models.ForeignKey(
        'kpi.Asset',
        related_name='advanced_features_set',
        null=False,
        blank=False,
        on_delete=models.CASCADE,
    )
    action = models.CharField(
        max_length=60,
        choices=Action.choices,
        db_index=True,
        null=False,
        blank=False,
    )
    question_xpath = models.CharField(null=False, blank=False, max_length=2000)
    params = LazyDefaultJSONBField(default=dict)

    class Meta:
        unique_together = ('asset_id', 'question_xpath', 'action')

    def to_action(self):
        action_class = ACTION_IDS_TO_CLASSES[self.action]
        return action_class(
            source_question_xpath=self.question_xpath,
            params=self.params,
            asset=self.asset,
        )
