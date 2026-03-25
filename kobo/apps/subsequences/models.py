from django.db import models

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kpi.fields import KpiUidField, LazyDefaultJSONBField
from kpi.models.abstract_models import AbstractTimeStampedModel
from .actions import ACTION_IDS_TO_CLASSES
from .constants import (
    SCHEMA_VERSIONS,
    SORT_BY_DATE_FIELD,
    SUBMISSION_UUID_FIELD,
    Action,
)
from .exceptions import InvalidAction, InvalidXPath
from .schemas import validate_submission_supplement


class SubmissionSupplement(AbstractTimeStampedModel):
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

    def __repr__(self):
        return f'Supplement for submission {self.submission_uuid}'

    @staticmethod
    def revise_data(asset: 'kpi.Asset', submission: dict, incoming_data: dict) -> dict:

        from .utils.versioning import migrate_submission_supplementals

        if not asset.advanced_features_set.exists():
            raise InvalidAction

        schema_version = incoming_data.get('_version')

        if schema_version not in SCHEMA_VERSIONS:
            # TODO: raise error. Unknown version
            raise NotImplementedError

        if schema_version != SCHEMA_VERSIONS[0]:
            migrated_data = migrate_submission_supplementals(incoming_data)
            if migrated_data is None:
                raise InvalidAction
            incoming_data = migrated_data

        submission_uuid = remove_uuid_prefix(
            submission[SUBMISSION_UUID_FIELD]
        )  # constant?
        supplemental_data = SubmissionSupplement.objects.get_or_create(
            asset=asset, submission_uuid=submission_uuid
        )[
            0
        ].content  # lock it?

        for question_xpath, data_for_this_question in incoming_data.items():
            if question_xpath == '_version':
                # FIXME: what's a better way? skip all leading underscore keys?
                # pop off the known special keys first?
                continue
            feature_configs_for_this_question = asset.advanced_features_set.filter(
                question_xpath=question_xpath
            )
            if not feature_configs_for_this_question.exists():
                raise InvalidXPath
            all_params = {
                feature.action: feature.params
                for feature in feature_configs_for_this_question
            }

            for action_id, action_data in data_for_this_question.items():
                if not ACTION_IDS_TO_CLASSES.get(action_id):
                    raise InvalidAction
                try:
                    feature = feature_configs_for_this_question.get(action=action_id)
                except QuestionAdvancedFeature.DoesNotExist as e:
                    raise InvalidAction from e

                question_supplemental_data = supplemental_data.setdefault(
                    question_xpath, {}
                )
                action_supplemental_data = question_supplemental_data.setdefault(
                    action_id, {}
                )

                prefetched_dependencies = {
                    'params': all_params,
                    'question_supplemental_data': question_supplemental_data,
                }
                action = feature.to_action(prefetched_dependencies)
                action.check_limits(asset.owner)

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
                # retrieved_supplemental_data.setdefault(question_xpath, {})[
                #    action_id
                # ] = action.retrieve_data(action_supplemental_data)

        supplemental_data['_version'] = schema_version
        validate_submission_supplement(asset, supplemental_data)
        SubmissionSupplement.objects.filter(
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

        from .utils.versioning import migrate_submission_supplementals

        if (submission_root_uuid is None) == (prefetched_supplement is None):
            raise ValueError(
                'Specify either `submission_root_uuid` or `prefetched_supplement`'
            )

        if submission_root_uuid:
            submission_uuid = remove_uuid_prefix(submission_root_uuid)
            try:
                supplemental_data = SubmissionSupplement.objects.get(
                    asset=asset, submission_uuid=submission_uuid
                ).content
            except SubmissionSupplement.DoesNotExist:
                supplemental_data = None
        else:
            supplemental_data = prefetched_supplement

        if not supplemental_data:
            return {}

        schema_version = supplemental_data.pop('_version', None)

        if schema_version not in SCHEMA_VERSIONS:
            # TODO: raise error. Unknown version
            raise NotImplementedError

        if schema_version != SCHEMA_VERSIONS[0]:
            migrated_data = migrate_submission_supplementals(supplemental_data)
            if migrated_data is None:
                raise InvalidAction
            supplemental_data = migrated_data
            schema_version = supplemental_data.pop('_version')

        retrieved_supplemental_data = {}
        data_for_output = {}

        for question_xpath, data_for_this_question in supplemental_data.items():
            processed_data_for_this_question = retrieved_supplemental_data.setdefault(
                question_xpath, {}
            )
            advanced_features_for_this_question = asset.advanced_features_set.filter(
                question_xpath=question_xpath
            )
            output_data_for_question = {}
            max_sort_by_date_by_key = {}

            for action_id, action_data in data_for_this_question.items():
                if not ACTION_IDS_TO_CLASSES.get(action_id):
                    # An action class present in the submission data no longer
                    # exists in the application code
                    # TODO: log an error
                    continue
                try:
                    feature = advanced_features_for_this_question.get(action=action_id)
                except QuestionAdvancedFeature.DoesNotExist as e:
                    raise InvalidAction from e

                action = feature.to_action()

                retrieved_data = action.retrieve_data(action_data)
                processed_data_for_this_question[action_id] = retrieved_data
                if for_output:
                    # Arbitrate the output data so that each column is only
                    # represented once, and that the most recently accepted
                    # action result is used as the value

                    # Columns may be represented by a string or a tuple of strings
                    # for when the API expects something like
                    # {'translation': {'lang1': {value...}, 'lang2': {value...}}}
                    # where ('translation','lang1') would be one key and
                    # ('translation', 'lang2') would be the other
                    transformed_data = action.transform_data_for_output(retrieved_data)
                    for field_key, field_data in transformed_data.items():
                        # Omit `_dateAccepted` from the output data
                        sort_by_date = field_data.pop(SORT_BY_DATE_FIELD, None)
                        if not sort_by_date:
                            # Never return data without a date
                            continue
                        existing_max_date = max_sort_by_date_by_key.get(field_key, '')
                        if not existing_max_date or existing_max_date < sort_by_date:
                            max_sort_by_date_by_key[field_key] = sort_by_date
                            if isinstance(field_key, str):
                                output_data_for_question[field_key] = field_data
                            else:
                                # see https://stackoverflow.com/questions/13687924/setting-a-value-in-a-nested-python-dictionary-given-a-list-of-indices-and-value  # noqa
                                current = output_data_for_question
                                for key_str in field_key[:-1]:
                                    current = current.setdefault(key_str, {})
                                current[field_key[-1]] = field_data
            data_for_output[question_xpath] = output_data_for_question

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
        constraints = [
            models.UniqueConstraint(
                fields=['asset_id', 'question_xpath', 'action'],
                name='unique_advanced_feature',
            )
        ]

    def save(self, *args, **kwargs):
        action_class = ACTION_IDS_TO_CLASSES[self.action]
        action_class.validate_params(self.params)
        super().save(*args, **kwargs)

    def to_action(self, prefetched_dependencies: dict | None = None) -> Action:
        action_class = ACTION_IDS_TO_CLASSES[self.action]
        return action_class(
            source_question_xpath=self.question_xpath,
            params=self.params,
            asset=self.asset,
            prefetched_dependencies=prefetched_dependencies,
        )
