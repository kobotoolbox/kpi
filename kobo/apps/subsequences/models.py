import hashlib
import json

from django.conf import settings
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
from kpi.utils.log import logging

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
                action.check_limits(asset.owner, action_data)

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


class BulkActionStatus(models.TextChoices):
    """
    Represents the lifecycle status of a batch job

    Note: There is no 'failed' status at the parent level. Only individual
    BulkActionItems can be 'failed'. A parent job is marked as 'complete'
    once all constituent items have reached a terminal state (complete,
    failed, or cancelled).
    """
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    COMPLETE = 'complete'
    CANCELLED = 'cancelled'


class BulkActionItemStatus(models.TextChoices):
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    COMPLETE = 'complete'
    FAILED = 'failed'
    CANCELLED = 'cancelled'


class SubsequenceBulkAction(AbstractTimeStampedModel):
    uid = KpiUidField(uid_prefix='sba', primary_key=True)
    asset = models.ForeignKey(
        'kpi.Asset',
        related_name='subsequence_bulk_actions',
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=20,
        choices=BulkActionStatus.choices,
        default=BulkActionStatus.PENDING,
        db_index=True,
    )
    action_id = models.CharField(
        max_length=60,
        choices=Action.choices,
        db_index=True,
    )
    question_xpath = models.CharField(max_length=2000)
    params = LazyDefaultJSONBField(default=dict)
    # Uses a denormalized username string, similar to `Asset.created_by`,
    # instead of a foreign key so job records remain intact through user
    # lifecycle changes and are inexpensive to render.
    created_by = models.CharField(max_length=150, db_index=True)
    cancelled_by = models.CharField(
        max_length=150,
        db_index=True,
        null=True,
        blank=True,
    )
    progress = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['-date_created']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_status = self.status

    @staticmethod
    def make_params_hash(params: dict) -> str:
        """
        Generates a deterministic SHA-256 hash from a dictionary of parameters

        To ensure idempotency, parameters are sorted by key before serialization
        so that identical settings always produce the same hash, regardless of
        dictionary order.
        """
        params_json = json.dumps(params, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(params_json.encode()).hexdigest()

    @classmethod
    def create_with_items(
        cls,
        *,
        asset,
        action_id: str,
        question_xpath: str,
        params: dict,
        created_by: str,
        submission_root_uuids: list[str],
        status: str = BulkActionStatus.PENDING,
    ) -> 'SubsequenceBulkAction':
        """
        Orchestrates the atomic creation of a bulk action and its constituent items

        This method wraps the creation of the parent `SubsequenceBulkAction` and all
        related `SubsequenceBulkActionItem` rows in a single database transaction.
        If any child item violates the uniqueness constraint, the entire transaction
        is rolled back to prevent partial or duplicate records.
        """
        if not submission_root_uuids:
            raise ValueError('A bulk action must target at least one submission.')

        params_hash = cls.make_params_hash(params)

        with transaction.atomic():
            parent = cls.objects.create(
                asset=asset,
                action_id=action_id,
                question_xpath=question_xpath,
                params=params,
                created_by=created_by,
                status=status,
            )
            SubsequenceBulkActionItem.objects.bulk_create(
                [
                    SubsequenceBulkActionItem(
                        parent=parent,
                        submission_root_uuid=submission_root_uuid,
                        action_id=action_id,
                        question_xpath=question_xpath,
                        status=status,
                        hash=params_hash,
                    )
                    for submission_root_uuid in submission_root_uuids
                ]
            )
        return parent

    def _propagate_status_to_items(self):
        """
        Synchronizes the status of non-terminal child items with the parent job

        When a parent job moves to 'in_progress', pending items are also moved
        to 'in_progress'. When a parent is 'cancelled', all active children are
        cancelled. Items already in a terminal state (complete, failed) are
        never modified.
        """
        if self.status == BulkActionStatus.IN_PROGRESS:
            self.items.filter(status=BulkActionItemStatus.PENDING).update(
                status=BulkActionItemStatus.IN_PROGRESS,
                date_modified=timezone.now(),
            )
        elif self.status == BulkActionStatus.CANCELLED:
            self.items.filter(
                status__in=[
                    BulkActionItemStatus.PENDING,
                    BulkActionItemStatus.IN_PROGRESS,
                ]
            ).update(
                status=BulkActionItemStatus.CANCELLED,
                date_modified=timezone.now(),
            )

    def save(
        self,
        force_insert=False,
        force_update=False,
        using=None,
        update_fields=None,
    ):
        is_new = self._state.adding
        should_sync_items = update_fields is None or 'status' in update_fields
        previous_status = self._original_status

        with transaction.atomic():
            super().save(
                force_insert=force_insert,
                force_update=force_update,
                using=using,
                update_fields=update_fields,
            )
            if should_sync_items and not is_new and previous_status != self.status:
                self._propagate_status_to_items()

        if should_sync_items:
            self._original_status = self.status

    def start_batch(self) -> 'SubsequenceBulkAction':
        """
        Move a pending batch into execution

        The parent status change propagates pending children to in_progress,
        then the child Celery jobs are queued after the transaction commits so
        workers never see partially-created bulk action rows.
        """
        with transaction.atomic():
            locked = type(self).objects.select_for_update().get(pk=self.pk)
            if locked.status != BulkActionStatus.PENDING:
                self.refresh_from_db()
                return self

            locked.status = BulkActionStatus.IN_PROGRESS
            locked.save(update_fields=['status', 'date_modified'])
            transaction.on_commit(lambda: locked._schedule_batch_tasks())

        self.refresh_from_db()
        return self

    def cancel(self, *, cancelled_by: str | None = None) -> 'SubsequenceBulkAction':
        """
        Cancels the bulk action job and propagates cancellation to all eligible
        child items

        Database state transitions are performed atomically. Failures during
        external Google cancellation requests are logged and do not roll back
        the database transaction.
        """
        with transaction.atomic():
            locked = type(self).objects.select_for_update().get(pk=self.pk)
            if locked.status in [BulkActionStatus.CANCELLED, BulkActionStatus.COMPLETE]:
                self.refresh_from_db()
                return self

            in_progress_items = list(
                locked.items.filter(
                    status=BulkActionItemStatus.IN_PROGRESS,
                ).exclude(
                    service_id__isnull=True,
                ).exclude(
                    service_id='',
                )
            )

            locked.status = BulkActionStatus.CANCELLED
            update_fields = ['status', 'date_modified']
            if cancelled_by and locked.cancelled_by != cancelled_by:
                locked.cancelled_by = cancelled_by
                update_fields.append('cancelled_by')
            locked.save(update_fields=update_fields)

        for item in in_progress_items:
            try:
                item.cancel_external_operation()
            except Exception:
                logging.exception(
                    'Failed to cancel bulk action external operation for '
                    f'{locked.uid=}, {item.uid=}, {item.service_id=}'
                )

        self.refresh_from_db()
        return self

    def _schedule_batch_tasks(self) -> None:
        """
        Enqueue one execution task per child item plus parent status polling

        Scheduling happens from transaction.on_commit() callbacks and watchdog
        tasks. Broker failures must not raise back into the request after the
        database transaction has already committed, stale in-progress batches
        are retried by resume_stuck_bulk_actions().
        """
        from .tasks import start_bulk_item_job, update_batch_status

        delay_between_jobs = self._get_delay_between_jobs()
        item_ids = list(
            self.items.filter(status=BulkActionItemStatus.IN_PROGRESS)
            .values_list('pk', flat=True)
        )

        for index, item_id in enumerate(item_ids):
            countdown = (index * delay_between_jobs) if delay_between_jobs else 0
            try:
                start_bulk_item_job.apply_async(
                    args=(item_id,),
                    countdown=countdown,
                )
            except Exception:
                logging.exception(
                    'Failed to schedule bulk action item job for '
                    f'{self.uid=}, {item_id=}'
                )

        try:
            update_batch_status.apply_async(
                args=(self.pk,),
                countdown=settings.BULK_ACTION_STATUS_POLL_INTERVAL,
            )
        except Exception:
            logging.exception(
                f'Failed to schedule bulk action status polling for {self.uid=}'
            )

    def _get_delay_between_jobs(self) -> float:
        """
        Return the per-item enqueue delay required by configured rate limits
        """
        config = settings.BULK_ACTION_RATE_LIMITS.get(self.action_id)
        if not config:
            return 0

        max_jobs_per_minute = config.get('max_jobs_per_minute', 0)
        if not max_jobs_per_minute:
            return 0
        return 60 / max_jobs_per_minute


class SubsequenceBulkActionItem(AbstractTimeStampedModel):
    uid = KpiUidField(uid_prefix='sbai', primary_key=True)
    parent = models.ForeignKey(
        SubsequenceBulkAction,
        related_name='items',
        on_delete=models.CASCADE,
    )
    submission_root_uuid = models.CharField(max_length=249, db_index=True)
    action_id = models.CharField(
        max_length=60,
        choices=Action.choices,
        db_index=True,
    )
    question_xpath = models.CharField(max_length=2000)
    status = models.CharField(
        max_length=20,
        choices=BulkActionItemStatus.choices,
        default=BulkActionItemStatus.PENDING,
        db_index=True,
    )
    hash = models.CharField(max_length=64, db_index=True)
    service_id = models.CharField(max_length=2048, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'action_id',
                    'submission_root_uuid',
                    'question_xpath',
                    'hash',
                ],
                condition=Q(
                    status__in=[
                        BulkActionItemStatus.PENDING,
                        BulkActionItemStatus.IN_PROGRESS,
                    ]
                ),
                name='uniq_active_bulk_job_item_per_submission_action',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.hash and self.parent_id:
            self.hash = self.parent.make_params_hash(self.parent.params)
        super().save(*args, **kwargs)

    def cancel_external_operation(self) -> None:
        if not self.service_id:
            return

        service = self._get_external_service()
        service.cancel_google_operation(self.service_id)

    def _get_external_service(self):
        from .integrations.google.google_transcribe import GoogleTranscriptionService
        from .integrations.google.google_translate import GoogleTranslationService

        service_class_by_action = {
            Action.AUTOMATIC_GOOGLE_TRANSCRIPTION: GoogleTranscriptionService,
            Action.AUTOMATIC_GOOGLE_TRANSLATION: GoogleTranslationService,
        }
        service_class = service_class_by_action.get(self.action_id)
        if service_class is None:
            raise ValueError(
                f'No external service registered for action_id={self.action_id}'
            )
        return service_class(
            submission={SUBMISSION_UUID_FIELD: self.submission_root_uuid},
            asset=self.parent.asset,
        )
