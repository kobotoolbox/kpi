#####
# WIP: Unfinished business
#
#####

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist

from kobo.apps.subsequences.exceptions import InvalidAction
from kobo.celery import celery_app



@celery_app.task(
    autoretry_for=(ObjectDoesNotExist,),
    max_retries=settings.MAX_RETRIES_FOR_IMPORT_EXPORT_TASK,
    retry_backoff=True,
)
def poll_run_automated_process(asset_id: int, submission: dict, action_data: dict):
    # Avoid circular import
    SubmissionSupplement = apps.get_model('subsequences', 'SubmissionSupplement')  # noqa
    try:
        submission_supplement = SubmissionSupplement.revise_data(
            asset_id, submission, action_data
        )
    except InvalidAction:
        return

    # submission
