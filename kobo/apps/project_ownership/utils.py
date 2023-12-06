from django.db import transaction
from django.utils import timezone

from kpi.deployment_backends.kc_access.shadow_models import ReadOnlyKobocatAttachment
from kpi.models.asset import AssetFile
from kpi.utils.django_orm_helper import ReplaceValues
from .models.choices import TransferAsyncTask, TransferStatus
from .exceptions import MongoUserFormIdRewriteException


def move_attachments(transfer: 'project_ownership.Transfer'):

    submissions = transfer.asset.deployment.get_submissions(
        transfer.asset.owner, fields=['_attachments']
    )
    attachment_ids = [a['id'] for i in submissions for a in i['_attachments']]
    for attachment in ReadOnlyKobocatAttachment.objects.filter(pk__in=attachment_ids):
        # Pretty slow but it should run in celery task. We want to be the
        # path of the file is saved right away.
        attachment.move()
        # TODO validate, it does not re-upload the file to S3
        attachment.save(update_fields=['content'])

    _mark_task_as_successful(transfer, TransferAsyncTask.ATTACHMENTS.value)


def move_media_files(transfer: 'project_ownership.Transfer'):
    for asset_file in transfer.asset.asset_files.filter(
        asset_type=AssetFile.FORM_MEDIA
    ):
        # Pretty slow but it should run in celery task. We want to be the
        # path of the file is saved right away.
        asset_file.move()
        # TODO validate, it does not re-upload the file to S3
        asset_file.save(update_fields=['content'])

    _mark_task_as_successful(transfer, TransferAsyncTask.MEDIA_FILES.value)


def rewrite_mongo_userform_id(transfer: 'project_ownership.Transfer'):
    new_owner = transfer.invite.destination_user
    if not transfer.asset.has_deployment:
        return

    if not transfer.asset.deployment.transfer_submissions_ownership(
        new_owner.username
    ):
        raise MongoUserFormIdRewriteException

    _mark_task_as_successful(transfer, TransferAsyncTask.SUBMISSIONS.value)


def _mark_task_as_successful(
    transfer: 'project_ownership.Transfer', async_task_type: str
):

    Transfer = transfer.__class__  # noqa
    Transfer.update_statuses(
        transfer.pk, TransferStatus.SUCCESS.value, async_task_type
    )
