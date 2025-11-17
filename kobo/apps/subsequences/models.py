from django.db import models, transaction

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kpi.fields import LazyDefaultJSONBField, KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel

from .constants import SCHEMA_VERSIONS, SUBMISSION_UUID_FIELD, Action
from .exceptions import InvalidAction, InvalidXPath
from .schemas import validate_submission_supplement
from .utils.action_conversion import question_advanced_action_to_action


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

        if not asset.advanced_features_set.exists():
            raise InvalidAction

        schema_version = incoming_data.get('_version')

        if schema_version not in SCHEMA_VERSIONS:
            # TODO: raise error. Unknown version
            raise NotImplementedError

        if schema_version != SCHEMA_VERSIONS[0]:
            # TODO: migrate from old per-submission schema
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

            action_configs_for_this_question = asset.advanced_features_set.filter(question_xpath=question_xpath)
            if not action_configs_for_this_question.exists():
                raise InvalidXPath

            for action_id, action_data in data_for_this_question.items():
                try:
                    question_advanced_action = action_configs_for_this_question.get(action=action_id)
                except QuestionAdvancedAction.DoesNotExist as e:
                    raise InvalidAction from e

                action = question_advanced_action_to_action(question_advanced_action)
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

        if not asset.advanced_features_set.exists():
            # TODO: migrate from old per-asset schema
            raise NotImplementedError

        retrieved_supplemental_data = {}
        data_for_output = {}

        for question_xpath, data_for_this_question in supplemental_data.items():
            processed_data_for_this_question = retrieved_supplemental_data.setdefault(
                question_xpath, {}
            )
            action_configs_for_this_question = asset.advanced_features_set.filter(question_xpath=question_xpath)
            if not action_configs_for_this_question.exists():
                continue

            for action_id, action_data in data_for_this_question.items():
                question_advanced_action = action_configs_for_this_question.get(action=action_id)

                action = question_advanced_action_to_action(question_advanced_action)

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


class QuestionAdvancedAction(models.Model):
    uid = KpiUidField(uid_prefix='qaa', primary_key=True)
    asset = models.ForeignKey('kpi.Asset', related_name='advanced_features_set',
                               null=False, blank=False, on_delete=models.CASCADE)
    action = models.CharField(
        max_length=60,
        choices=Action.choices,
        db_index=True,
        null=False,
        blank=False,
    )
    question_xpath = models.CharField(
        null=False, blank=False, max_length=2000
    )
    params = LazyDefaultJSONBField(default=dict)

    class Meta:
        unique_together = ('asset_id', 'question_xpath', 'action')

def migrate_advanced_features(asset: 'kpi.models.Asset') -> dict | None:
    advanced_features = asset.advanced_features
    known_cols = set([col.split(":")[0] for col in asset.known_cols])

    if advanced_features == {}:
        return

    with transaction.atomic():
        for key, value in advanced_features.items():
            if (
                key == 'transcript'
                and value
                and 'languages' in value
                and value['languages']
            ):
                for q in known_cols:
                    QuestionAdvancedAction.objects.create(
                        question_xpath=q,
                        asset=asset,
                        action=Action.MANUAL_TRANSCRIPTION,
                        params=[
                            {'language': language} for language in value['languages']
                        ]
                    )

            if (
                key == 'translation'
                and value
                and 'languages' in value
                and value['languages']
            ):
                for q in known_cols:
                    QuestionAdvancedAction.objects.create(
                        question_xpath=q,
                        asset=asset,
                        action=Action.MANUAL_TRANSCRIPTION,
                        params=[
                            {'language': language} for language in value['languages']
                        ]
                    )
            if key == 'qual':
                # TODO: DEV-1295
                pass
        asset.advanced_features = {}
        asset.save(update_fields=['advanced_features'], adjust_content=False)

