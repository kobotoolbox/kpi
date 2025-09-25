from celery.signals import task_failure

from django.apps import apps
from kobo.celery import celery_app
from kobo.apps.openrosa.libs.utils.jsonbfield_helper import ReplaceValues
from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError
from .constants import SUBMISSION_UUID_FIELD
from .exceptions import InvalidAction, InvalidXPath
from kobo.apps.openrosa.apps.logger.xform_instance_parser import remove_uuid_prefix


# TODO Adjust max_retries. Should be no longer than external service timeout (28800 s).
@celery_app.task(
    autoretry_for=(SubsequenceTimeoutError,),
    retry_backoff=5,
    retry_backoff_max=60,
    max_retries=2,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
)
def poll_run_automated_process(
    asset_id: int,
    submission: dict,
    question_xpath: str,
    action_id: str,
    action_data: dict,
):
    Asset = apps.get_model('kpi', 'Asset')  # noqa: N806
    SubmissionSupplement = apps.get_model('subsequences', 'SubmissionSupplement')  # noqa: N806
    incoming_data = {
        '_version': '20250820',
        question_xpath: {action_id: action_data},
    }
    asset = Asset.objects.only('pk', 'owner_id').get(id=asset_id)
    supplement_data = SubmissionSupplement.revise_data(asset, submission, incoming_data)

    last_action_version = supplement_data[question_xpath][action_id]['_versions'][0]

    if last_action_version['status'] == 'in_progress':
        raise SubsequenceTimeoutError(
            f'{action_id} is still in progress for submission '
            f'{submission[SUBMISSION_UUID_FIELD]}'
        )


@task_failure.connect(sender=poll_run_automated_process)
def poll_run_automated_process_failure(sender=None, **kwargs):

    # Avoid circular import
    from .actions import ACTION_IDS_TO_CLASSES
    Asset = apps.get_model('kpi', 'Asset')  # noqa: N806
    SubmissionSupplement = apps.get_model('subsequences', 'SubmissionSupplement')  # noqa: N806

    asset_id = kwargs['kwargs']['asset_id']
    error = str(kwargs['exception'])
    submission = kwargs['kwargs']['submission']
    question_xpath = kwargs['kwargs']['question_xpath']
    action_id = kwargs['kwargs']['action_id']
    action_data = kwargs['kwargs']['action_data']

    asset = Asset.objects.only('pk', 'owner_id', 'advanced_features').get(id=asset_id)

    supplemental_data = SubmissionSupplement.retrieve_data(
        asset, submission_root_uuid=submission[SUBMISSION_UUID_FIELD]
    )
    # TODO Add failure to DB
    if 'is still in progress for submission' in error:
        error = 'Maximum retries exceeded.'

    action_class = ACTION_IDS_TO_CLASSES[action_id]
    action_configs = asset.advanced_features['_actionConfigs']
    action_configs_for_this_question = action_configs[question_xpath]
    action_params = action_configs_for_this_question[action_id]
    action = action_class(question_xpath, action_params)

    action_supplemental_data = supplemental_data[question_xpath][action_id]
    action_data.update({
        'error': error,
        'status': 'failed', # TODO maybe add dependency?
    })
    dependency_supplemental_data = {}

    new_action_supplemental_data = action.get_new_action_supplemental_data(
        action_supplemental_data, action_data, dependency_supplemental_data
    )

    SubmissionSupplement.objects.filter()
    submission_uuid = remove_uuid_prefix(submission[SUBMISSION_UUID_FIELD])

    SubmissionSupplement.objects.filter(
        asset=asset, submission_uuid=submission_uuid
    ).update(
        content=ReplaceValues(
            'content',
            path=f'{question_xpath}__{action_id}',
            updates=new_action_supplemental_data,
        )
    )
