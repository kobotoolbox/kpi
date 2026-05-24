from datetime import timedelta

from celery.signals import task_failure
from django.conf import settings
from django.apps import apps
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError
from kobo.celery import celery_app
from kpi.utils.log import logging
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes
from .constants import SCHEMA_VERSIONS, SUBMISSION_UUID_FIELD


# With retry_backoff=5 and retry_backoff_max=60, each retry waits:
#   min(5 * 2^(n-1), 60) seconds.
# We also add an initial 10s delay before the first attempt.
# Total wait time must stay ≤ 28,800 s (GOOGLE_CACHE_TIMEOUT).
# Calculation:
#   10 (initial) + (5 + 10 + 20 + 40) + 60 * k  ≤ 28,800
#   => k = floor((28,800 - 10 - 75) / 60) = 478
#   => max_retries = 4 (before cap) + 478 = 482
# So set max_retries to 482 or less to stay within the 8-hour limit.
@celery_app.task(
    autoretry_for=(SubsequenceTimeoutError,),
    retry_backoff=5,
    retry_backoff_max=60,
    max_retries=482,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
)
def poll_run_external_process(
    asset_id: int,
    submission: dict,
    question_xpath: str,
    action_id: str,
    action_data: dict,
):
    Asset = apps.get_model('kpi', 'Asset')  # noqa: N806
    SubmissionSupplement = apps.get_model(
        'subsequences', 'SubmissionSupplement'
    )  # noqa: N806
    incoming_data = {
        '_version': SCHEMA_VERSIONS[0],
        question_xpath: {action_id: action_data},
    }
    asset = Asset.objects.only('pk', 'owner_id').get(id=asset_id)
    # FIXME: revise_data cannot handle action_data with dependencies already attached
    supplement_data = SubmissionSupplement.revise_data(asset, submission, incoming_data)
    if supplement_data is None:
        supplement_data = _get_submission_supplement_data(
            asset=asset,
            submission=submission,
        )
    action = _get_advanced_feature(asset, question_xpath, action_id)
    last_status = _extract_bulk_item_status(
        asset=asset,
        action=action,
        supplement_data=supplement_data,
        action_data=action_data,
    )
    _update_bulk_action_item_status(
        submission=submission,
        action_data=action_data,
        status=last_status,
    )

    if last_status == 'in_progress':
        raise SubsequenceTimeoutError(
            f'{action_id} is still in progress for submission '
            f'{submission[SUBMISSION_UUID_FIELD]}'
        )


@task_failure.connect(sender=poll_run_external_process)
def poll_run_external_process_failure(sender=None, **kwargs):

    # Avoid circular import
    Asset = apps.get_model('kpi', 'Asset')  # noqa: N806
    SubmissionSupplement = apps.get_model(
        'subsequences', 'SubmissionSupplement'
    )  # noqa: N806

    asset_id = kwargs['kwargs']['asset_id']
    error = str(kwargs['exception'])
    submission = kwargs['kwargs']['submission']
    question_xpath = kwargs['kwargs']['question_xpath']
    action_id = kwargs['kwargs']['action_id']
    action_data = kwargs['kwargs']['action_data']

    asset = (
        Asset.objects.only('pk', 'owner_id', 'advanced_features')
        .select_related('owner')
        .get(id=asset_id)
    )

    supplemental_data = SubmissionSupplement.retrieve_data(
        asset, submission_root_uuid=submission[SUBMISSION_UUID_FIELD]
    )
    if 'is still in progress for submission' in error:
        error = 'Maximum retries exceeded.'

    feature = asset.advanced_features_set.get(
        question_xpath=question_xpath, action=action_id
    )
    prefetched_dependencies = {
        'question_supplemental_data': supplemental_data[question_xpath],
    }
    action = feature.to_action(prefetched_dependencies=prefetched_dependencies)

    # FIXME: raises KeyError if action results are further nested (eg translations)
    action_supplemental_data = supplemental_data[question_xpath][action_id]
    action_data.update(
        {
            'error': error,
            'status': 'failed',
        }
    )
    # FIXME We assume that the last action is the one in progress but it could
    #   be another one.
    dependency_supplemental_data = action_supplemental_data['_versions'][0].get(
        action.DEPENDENCY_FIELD
    )

    new_action_supplemental_data = action.get_new_action_supplemental_data(
        action_supplemental_data, action_data, dependency_supplemental_data
    )

    submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])
    SubmissionSupplement.objects.filter(
        asset=asset, submission_uuid=submission_uuid
    ).update(
        content=UpdateJSONFieldAttributes(
            'content',
            path=f'{question_xpath}__{action_id}',
            updates=new_action_supplemental_data,
        )
    )
    _update_bulk_action_item_status(
        submission=submission,
        action_data=action_data,
        status='failed',
    )


@celery_app.task(
    autoretry_for=(SubsequenceTimeoutError,),
    retry_backoff=5,
    retry_backoff_max=60,
    max_retries=482,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
)
def start_bulk_item_job(bulk_action_item_id: str):
    """
    Start one child item in a bulk action

    The task reuses SubmissionSupplement.revise_data() so bulk transcription and
    translation run through the same validation, supplement writing, and Google
    integration paths as single-submission processing.
    """
    SubsequenceBulkActionItem = apps.get_model(  # noqa: N806
        'subsequences',
        'SubsequenceBulkActionItem',
    )

    item = (
        SubsequenceBulkActionItem.objects.select_related('parent', 'parent__asset')
        .get(pk=bulk_action_item_id)
    )

    # Handle early dequeues (race conditions) and ignore terminal states
    if item.status == 'pending':
        if item.parent.status != 'in_progress':
            return
        item.status = 'in_progress'
        item.save(update_fields=['status', 'date_modified'])
    elif item.status != 'in_progress':
        return

    action = item.parent
    asset = action.asset
    try:
        submission = _get_submission_for_bulk_action_item(item)
    except Exception:
        logging.exception(
            'Failed to load submission for bulk item '
            f'{item.uid=}, {action.uid=}, {item.submission_root_uuid=}'
        )
        _mark_bulk_item_failed(item)
        return

    if submission is None:
        _mark_bulk_item_failed(item)
        return

    incoming_action_data = dict(action.params)
    incoming_action_data['bulk_action_uid'] = action.uid
    incoming_data = {
        '_version': SCHEMA_VERSIONS[0],
        action.question_xpath: {
            action.action_id: incoming_action_data,
        },
    }

    try:
        supplement_data = apps.get_model(
            'subsequences', 'SubmissionSupplement'
        ).revise_data(asset, submission, incoming_data)
    except SubsequenceTimeoutError:
        raise
    except Exception:
        logging.exception(
            'Bulk item execution failed for '
            f'{item.uid=}, {action.uid=}, {item.submission_root_uuid=}'
        )
        _mark_bulk_item_failed(item)
        return

    if supplement_data is None:
        supplement_data = _get_submission_supplement_data(
            asset=asset,
            submission=submission,
        )

    if not supplement_data:
        logging.error(
            'Bulk item execution produced no supplement data for '
            f'{item.uid=}, {action.uid=}, {item.submission_root_uuid=}'
        )
        _mark_bulk_item_failed(item)
        return

    try:
        extracted_status = _extract_bulk_item_status(
            asset=asset,
            action=action,
            supplement_data=supplement_data,
            action_data=incoming_action_data,
        )
    except Exception:
        logging.exception(
            'Failed to extract bulk item status for '
            f'{item.uid=}, {action.uid=}, {item.submission_root_uuid=}'
        )
        _mark_bulk_item_failed(item)
        return

    item.status = extracted_status
    item.save(update_fields=['status', 'date_modified'])
    if extracted_status == 'in_progress':
        poll_run_external_process.apply_async(
            kwargs={
                'submission': submission,
                'action_data': incoming_action_data,
                'action_id': action.action_id,
                'asset_id': asset.pk,
                'question_xpath': action.question_xpath,
            },
            countdown=10,
        )


@celery_app.task(queue='kpi_low_priority_queue')
def update_batch_status(subsequence_bulk_action_id: str):
    """
    Refresh parent progress from child item states

    The parent stays in_progress while any item is active. Once all items are in
    terminal states, the parent is marked complete and progress reaches 100.
    """
    SubsequenceBulkAction = apps.get_model(  # noqa: N806
        'subsequences',
        'SubsequenceBulkAction',
    )

    poll_interval = getattr(settings, 'BULK_ACTION_STATUS_POLL_INTERVAL', 30)
    with transaction.atomic():
        action = (
            SubsequenceBulkAction.objects.select_for_update(skip_locked=True)
            .filter(pk=subsequence_bulk_action_id, status='in_progress')
            .first()
        )
        if not action:
            return

        counts = action.items.aggregate(
            total=Count('pk'),
            active=Count(
                'pk',
                filter=Q(status__in=['pending', 'in_progress']),
            ),
            terminal=Count(
                'pk',
                filter=Q(status__in=['complete', 'failed', 'cancelled']),
            ),
        )
        total = counts['total'] or 0
        terminal = counts['terminal'] or 0
        active = counts['active'] or 0
        progress = int((terminal / total) * 100) if total else 100
        next_status = 'in_progress' if active else 'complete'

        update_fields = ['progress', 'date_modified']
        action.progress = progress
        if action.status != next_status:
            action.status = next_status
            update_fields.append('status')
        action.save(update_fields=update_fields)

    if next_status == 'in_progress':
        update_batch_status.apply_async(
            args=(subsequence_bulk_action_id,),
            countdown=poll_interval,
        )


@celery_app.task(queue='kpi_low_priority_queue')
def resume_stuck_bulk_actions():
    """
    Restart status polling for stale in-progress bulk actions

    This watchdog protects batches from staying stale if a previous polling task
    was lost or the worker restarted between scheduled polls.
    """
    SubsequenceBulkAction = apps.get_model(  # noqa: N806
        'subsequences',
        'SubsequenceBulkAction',
    )
    threshold_seconds = getattr(settings, 'BULK_ACTION_STUCK_THRESHOLD', 300)
    cutoff = timezone.now() - timedelta(seconds=threshold_seconds)
    action_ids = SubsequenceBulkAction.objects.filter(
        status='in_progress',
        date_modified__lt=cutoff,
    ).values_list('pk', flat=True)
    for action_id in action_ids:
        update_batch_status.delay(action_id)


def _get_submission_for_bulk_action_item(item):
    """
    Load the deployed submission targeted by a bulk action item
    """
    submissions = item.parent.asset.deployment.get_submissions(
        user=item.parent.asset.owner,
        query={'meta/rootUuid': add_uuid_prefix(item.submission_root_uuid)},
    )
    return next(iter(submissions), None)


def _mark_bulk_item_failed(item) -> None:
    """
    Move a child item to failed so the parent batch can reach a terminal state
    """
    item.status = 'failed'
    item.save(update_fields=['status', 'date_modified'])


def _get_submission_supplement_data(asset, submission: dict) -> dict:
    """
    Read the current supplement when revise_data() exits without new content
    """
    SubmissionSupplement = apps.get_model(  # noqa: N806
        'subsequences',
        'SubmissionSupplement',
    )
    submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])
    return SubmissionSupplement.retrieve_data(
        asset,
        submission_root_uuid=submission_uuid,
    )


def _extract_bulk_item_status(
    asset,
    action,
    supplement_data: dict,
    action_data: dict,
) -> str:
    """
    Extract the latest status from supplement content for a bulk-aware action

    `action` may be either a SubsequenceBulkAction or a QuestionAdvancedFeature,
    depending on whether the caller is the bulk starter or the shared poller.
    """
    question_xpath = action.question_xpath
    action_id = action.action_id if hasattr(action, 'action_id') else action.action
    action_handler = _get_advanced_feature(
        asset,
        question_xpath,
        action_id,
    ).to_action()
    raw_action_data = (
        supplement_data.get(question_xpath, {}).get(action_id) or {}
    )
    localized_action_data = raw_action_data
    if action_handler.action_class_config.allow_multiple:
        data_key = action_handler.action_class_config.action_data_key
        if not data_key:
            raise ValueError(
                f'{action_id} is configured with allow_multiple but '
                'has no action_data_key'
            )
        localized_action_data = raw_action_data.get(action_data.get(data_key)) or {}
    versions = localized_action_data.get(action_handler.VERSION_FIELD) or []
    if not versions:
        raise ValueError(
            f'No versions found in supplemental data for {action_id}'
        )

    version_data = versions[0].get(action_handler.VERSION_DATA_FIELD) or {}
    status = version_data.get('status')
    if not status:
        raise ValueError(
            f'No status found in supplemental data for {action_id}'
        )
    return status


def _get_advanced_feature(asset, question_xpath: str, action_id: str):
    """
    Return the configured advanced feature for a question and action
    """
    return asset.advanced_features_set.get(
        question_xpath=question_xpath,
        action=action_id,
    )


def _update_bulk_action_item_status(
    submission: dict,
    action_data: dict,
    status: str,
) -> None:
    """
    Mirror an async supplement status back to the matching bulk child item
    """
    bulk_action_uid = action_data.get('bulk_action_uid')
    if not bulk_action_uid:
        return

    SubsequenceBulkActionItem = apps.get_model(  # noqa: N806
        'subsequences',
        'SubsequenceBulkActionItem',
    )
    submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])
    SubsequenceBulkActionItem.objects.filter(
        parent__uid=bulk_action_uid,
        submission_root_uuid=submission_uuid,
    ).update(
        status=status,
        date_modified=timezone.now(),
    )
