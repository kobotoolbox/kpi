###########################
# WIP: Unfinished business#
###########################
from django.apps import apps
from kobo.apps.subsequences.exceptions import SubsequenceTimeoutError
from kobo.celery import celery_app


# TODO Adjust max_retries. Should be no longer than external service timeout.
@celery_app.task(
    autoretry_for=(SubsequenceTimeoutError,),
    retry_backoff=60,
    max_retries=5,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
)
def poll_run_automated_process(
    submission: dict,
    question_supplemental_data: dict,
    action_supplement_data: dict,
    action_data: dict,
    action_id: str,
    asset_id: int,
):
    Asset = apps.get_model('kpi', 'Asset')  # noqa: N806
    SubmissionSupplement = apps.get_model('subsequences', 'SubmissionSupplement')  # noqa: N806
    # TODO Rebuild incoming data from question supplemental data.
    #   We are missing the question_name_xpath, see comment in
    #   `SupplementData.revise_data()`
    incoming_data = {}

    asset = Asset.objects.defer('content').get(id=asset_id)
    supplement_data = SubmissionSupplement.revise_data(asset, submission, incoming_data)
    if supplement_data['status'] == 'in_progress':
        raise SubsequenceTimeoutError
