from celery.signals import task_failure
from django.apps import apps

from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix
from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError
from kobo.celery import celery_app
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
    from .actions.base import BaseAction

    Asset = apps.get_model('kpi', 'Asset')  # noqa: N806
    SubmissionSupplement = apps.get_model(
        'subsequences', 'SubmissionSupplement'
    )  # noqa: N806
    incoming_data = {
        '_version': SCHEMA_VERSIONS[0],
        question_xpath: {action_id: action_data},
    }
    asset = Asset.objects.only('pk', 'owner_id').get(id=asset_id)

    supplement_data = SubmissionSupplement.revise_data(asset, submission, incoming_data)

    last_action_version = supplement_data[question_xpath][action_id]['_versions'][0]

    if last_action_version[BaseAction.VERSION_DATA_FIELD]['status'] == 'in_progress':
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
