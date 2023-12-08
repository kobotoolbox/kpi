import os
import time
from typing import Optional

from django.apps import apps
from django.utils import timezone

from kpi.deployment_backends.kc_access.shadow_models import KobocatAttachment
from kpi.models.asset import AssetFile
from kpi.utils.log import logging
from .models.choices import TransferStatusChoices, TransferStatusTypeChoices
from .exceptions import AsyncTaskException


def get_target_folder(
    transfer: 'project_ownership.Transfer', filename: str
) -> Optional[str]:
    old_owner = transfer.invite.source_user
    new_owner = transfer.invite.destination_user

    try:
        target_folder = os.path.dirname(
            filename.replace(old_owner.username, new_owner.username)
        )
    except FileNotFoundError:
        logging.error(
            f'File not found: {filename}',
            exc_info=True,
        )
    else:
        return target_folder


def move_attachments(transfer: 'project_ownership.Transfer'):

    async_task_type = TransferStatusTypeChoices.ATTACHMENTS.value

    # Attachments cannot be moved until `_userform_id` is updated successfully
    if not (
        transfer.statuses.filter(
            status_type=TransferStatusTypeChoices.SUBMISSIONS.value,
            status=TransferStatusChoices.SUCCESS.value,
        ).exists()
    ):
        raise AsyncTaskException(
            '`_userform_id` has not been updated successfully'
        )

    submissions = transfer.asset.deployment.get_submissions(
        transfer.asset.owner, fields=['_attachments']
    )
    attachment_ids = [a['id'] for i in submissions for a in i['_attachments']]
    attachments = KobocatAttachment.objects.filter(
        pk__in=attachment_ids
    ).exclude(media_file__startswith=f'{transfer.asset.owner.username}/')

    print('ATTACHMENT COUNTS', attachments.count())

    for attachment in attachments.iterator():
        # Pretty slow but it should run in celery task. We want to be the
        # path of the file is saved right away. It lets us resume when it stopped
        # in case of failure.
        if not (
            target_folder := get_target_folder(
                transfer, attachment.media_file.name
            )
        ):
            print(f'Could not find target_folder', flush=True)
            continue
        else:
            print(f'MOVE TO {target_folder}', flush=True)
            attachment.media_file.move(target_folder)
            # TODO validate, it does not re-upload the file to S3
            attachment.save(update_fields=['media_file'])

            # We only need to update `date_modified` to update task heart beat.
            # No need to use `TransferStatus.update_status()` and
            # its lock mechanism.
            transfer.statuses.filter(status_type=async_task_type).update(
                date_modified=timezone.now()
            )
            print('WAITING... ')
            time.sleep(60)

    _mark_task_as_successful(transfer, async_task_type)


def move_media_files(transfer: 'project_ownership.Transfer'):

    async_task_type = TransferStatusTypeChoices.MEDIA_FILES.value
    media_files = transfer.asset.asset_files.filter(
        file_type=AssetFile.FORM_MEDIA
    ).exclude(content__startswith=f'{transfer.asset.owner.username}/')

    for media_file in media_files:
        # Pretty slow but it should run in celery task. We want to be sure the
        # path of the file is saved right away. It lets us resume when it stopped
        # in case of failure.
        media_file.move()
        # TODO validate, it does not re-upload the file to S3
        media_file.save(update_fields=['content'])

        # We only need to update `date_modified` to update task heart beat.
        # No need to use `TransferStatus.update_status()` and
        # its lock mechanism.
        transfer.statuses.filter(status_type=async_task_type).update(
            date_modified=timezone.now()
        )

    # Do not sync undeployed thing.
    # transfer.asset.deployment.sync_media_files()

    _mark_task_as_successful(transfer, async_task_type)


def rewrite_mongo_userform_id(transfer: 'project_ownership.Transfer'):
    new_owner = transfer.invite.destination_user

    if not transfer.asset.has_deployment:
        return

    if not transfer.asset.deployment.transfer_submissions_ownership(
        new_owner.username
    ):
        raise AsyncTaskException(
            'Could not rewrite MongoDB `_userform_id` successfully'
        )

    _mark_task_as_successful(
        transfer, TransferStatusTypeChoices.SUBMISSIONS.value
    )


def _mark_task_as_successful(
    transfer: 'project_ownership.Transfer', async_task_type: str
):
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa
    TransferStatus.update_status(
        transfer.pk, TransferStatusChoices.SUCCESS.value, async_task_type
    )
