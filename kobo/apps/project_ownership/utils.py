import os
import time
from typing import Optional

from django.apps import apps
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatAttachment,
    KobocatMetadata,
)
from kpi.models.asset import AssetFile
from .models.choices import TransferStatusChoices, TransferStatusTypeChoices
from .exceptions import AsyncTaskException
from .constants import ASYNC_TASK_HEARTBEAT, FILE_MOVE_CHUNK_SIZE


def get_target_folder(
    previous_owner_username: str, new_owner_username: str, filename: str
) -> Optional[str]:

    if not filename:
        return

    target_folder = os.path.dirname(
        filename.replace(previous_owner_username, new_owner_username)
    )

    return target_folder


def move_attachments(transfer: 'project_ownership.Transfer'):

    async_task_type = TransferStatusTypeChoices.ATTACHMENTS

    # Attachments cannot be moved until `_userform_id` is updated successfully
    if not (
        transfer.statuses.filter(
            status_type=TransferStatusTypeChoices.SUBMISSIONS,
            status=TransferStatusChoices.SUCCESS,
        ).exists()
    ):
        raise AsyncTaskException(
            '`_userform_id` has not been updated successfully'
        )

    submissions = transfer.asset.deployment.get_submissions(
        transfer.asset.owner, fields=['_id']
    )

    submission_ids = [
        s['_id']
        for s in submissions
    ]

    if not submission_ids:
        _mark_task_as_successful(transfer, async_task_type)
        return

    attachments = KobocatAttachment.all_objects.filter(
        instance_id__in=submission_ids
    ).exclude(media_file__startswith=f'{transfer.asset.owner.username}/')

    attachments_to_update = []
    try:
        heartbeat = int(time.time())
        # Moving files is pretty slow, thus it should run in a celery task.
        for attachment in attachments.iterator():
            if not (
                target_folder := get_target_folder(
                    transfer.invite.sender.username,
                    transfer.invite.recipient.username,
                    attachment.media_file.name,
                )
            ):
                continue
            else:
                # We want to be sure the path of the file is saved no matter what.
                # Thanks to try/finally block, if updates are still pending, they
                # should be saved in case of errors.
                # It lets us resume when it stopped in case of failure.
                attachment.media_file.move(target_folder)
                attachments_to_update.append(attachment)

                if len(attachments_to_update) > FILE_MOVE_CHUNK_SIZE:
                    Attachment.objects.bulk_update(
                        attachments_to_update, fields=['media_file']
                    )
                    attachments_to_update = []

                heartbeat = _update_heartbeat(heartbeat, transfer, async_task_type)

    finally:
        if attachments_to_update:
            Attachment.objects.bulk_update(
                attachments_to_update, fields=['media_file']
            )

    _mark_task_as_successful(transfer, async_task_type)


def move_media_files(transfer: 'project_ownership.Transfer'):

    async_task_type = TransferStatusTypeChoices.MEDIA_FILES
    media_files = transfer.asset.asset_files.filter(
        file_type=AssetFile.FORM_MEDIA
    ).exclude(content__startswith=f'{transfer.asset.owner.username}/')

    kc_files = {}

    if transfer.asset.has_deployment:
        kc_files = {
            kc_file.file_hash: kc_file
            for kc_file in KobocatMetadata.objects.filter(
                xform_id=transfer.asset.deployment.xform.pk
            )
        }

    media_files_to_update = []
    metadata_to_update = []
    try:
        heartbeat = int(time.time())
        # Moving files is pretty slow, thus it should run in a celery task.
        for media_file in media_files:
            if not (
                target_folder := get_target_folder(
                    transfer.invite.sender.username,
                    transfer.invite.recipient.username,
                    media_file.content.name,
                )
            ):
                continue
            else:
                # We want to be sure the path of the file is saved no matter what.
                # Thanks to try/finally block, if updates are still pending, they
                # should be saved in case of errors.
                # It lets us resume when it stopped in case of failure.
                media_file.content.move(target_folder)
                old_md5 = media_file.metadata.pop('hash', None)
                media_file.set_md5_hash()
                if old_md5 in kc_files.keys():
                    kc_obj = kc_files[old_md5]
                    if kc_target_folder := get_target_folder(
                        transfer.invite.sender.username,
                        transfer.invite.recipient.username,
                        kc_obj.data_file.name,
                    ):
                        kc_obj.data_file.move(kc_target_folder)
                        kc_obj.file_hash = media_file.md5_hash
                        metadata_to_update.append(kc_obj)

                media_files_to_update.append(media_file)
                heartbeat = _update_heartbeat(heartbeat, transfer, async_task_type)

    finally:
        # No need to use chunk size for media files like we do for attachments,
        # because the odds are pretty low that more than 100 media files are
        # linked to the project.
        if metadata_to_update:
            media_files_to_update.append(media_file)

        if media_files_to_update:
            AssetFile.objects.bulk_update(
                media_files_to_update, fields=['content', 'metadata']
            )

    _mark_task_as_successful(transfer, async_task_type)


def rewrite_mongo_userform_id(transfer: 'project_ownership.Transfer'):
    old_owner = transfer.invite.sender

    if not transfer.asset.has_deployment:
        return

    if not transfer.asset.deployment.transfer_submissions_ownership(
        old_owner.username
    ):
        raise AsyncTaskException(
            'Could not rewrite MongoDB `_userform_id` successfully'
        )

    _mark_task_as_successful(
        transfer, TransferStatusTypeChoices.SUBMISSIONS
    )


def _mark_task_as_successful(
    transfer: 'project_ownership.Transfer', async_task_type: str
):
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa
    TransferStatus.update_status(
        transfer.pk, TransferStatusChoices.SUCCESS, async_task_type
    )


def _update_heartbeat(
    heartbeat: int, transfer: 'project_ownership.Transfer', async_task_type: str
) -> int:

    if heartbeat + ASYNC_TASK_HEARTBEAT >= time.time():
        # We only need to update `date_modified` to update task heartbeat.
        # No need to use `TransferStatus.update_status()` and
        # its lock mechanism.
        transfer.statuses.filter(status_type=async_task_type).update(
            date_modified=timezone.now()
        )
        return int(time.time())

    return heartbeat
