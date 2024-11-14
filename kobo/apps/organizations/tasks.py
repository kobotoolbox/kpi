from django.conf import settings
from more_itertools import chunked

from kobo.apps.kobo_auth.shortcuts import User
from kobo.celery import celery_app
from kobo.apps.project_ownership.utils import create_invite


@celery_app.task(
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def transfer_user_ownership_to_org(user_id: int):
    sender = User.objects.get(pk=user_id)
    recipient = sender.organization.owner_user_object
    user_assets = sender.assets.only('pk', 'uid').iterator()

    # Splitting assets into batches to avoid creating a long-running
    # Celery task that could exceed Celery's soft time limit or consume
    # too much RAM, potentially leading to termination by Kubernetes.
    for asset_batch in chunked(
        user_assets, settings.USER_ASSET_ORG_TRANSFER_BATCH_SIZE
    ):
        create_invite(
            sender=sender,
            recipient=recipient,
            assets=asset_batch,
            invite_class_name='OrgMembershipAutoInvite',
        )
