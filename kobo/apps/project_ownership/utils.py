import os
import time
from typing import Literal, Optional, Union

from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.main.models import MetaData
from kobo.apps.project_ownership.models import InviteStatusChoices
from kpi.deployment_backends.kc_access.storage import default_kobocat_storage
from kpi.models.asset import Asset, AssetFile
from kpi.utils.log import logging
from .constants import ASYNC_TASK_HEARTBEAT
from .exceptions import AsyncTaskException
from .models.choices import TransferStatusChoices, TransferStatusTypeChoices


def create_invite(
    sender: 'User',
    recipient: 'User',
    assets: list[Asset],
    invite_class_name: str = Literal['Invite', 'OrgMembershipAutoInvite'],
) -> Union['Invite', 'OrgMembershipAutoInvite']:

    InviteModel = apps.get_model('project_ownership', invite_class_name)
    Transfer = apps.get_model('project_ownership', 'Transfer')
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')

    with transaction.atomic():
        invite = InviteModel.objects.create(sender=sender, recipient=recipient)
        transfers = Transfer.objects.bulk_create(
            [Transfer(invite=invite, asset=asset) for asset in assets]
        )
        statuses = []
        for transfer in transfers:
            for status_type in TransferStatusTypeChoices.values:
                statuses.append(
                    TransferStatus(
                        transfer=transfer,
                        status_type=status_type,
                    )
                )
        TransferStatus.objects.bulk_create(statuses)

    if invite.auto_accept_invites:
        update_invite(invite, status=InviteStatusChoices.ACCEPTED)
    else:
        invite.send_invite_email()

    return invite


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

    attachments = Attachment.all_objects.filter(instance_id__in=submission_ids).exclude(
        media_file__startswith=f'{transfer.asset.owner.username}/'
    )

    heartbeat = int(time.time())
    # Moving files is pretty slow, thus it should run in a celery task.
    errors = False
    for attachment in attachments.iterator():
        update_fields = ['user_id']
        media_file_path = attachment.media_file.name
        if (
            target_folder := get_target_folder(
                transfer.invite.sender.username,
                transfer.invite.recipient.username,
                media_file_path,
            )
        ):
            # There is no way to ensure atomicity when moving the file and saving the
            # object to the database. Fingers crossed that the process doesn't get
            # interrupted between these two operations.
            if attachment.media_file.move(target_folder):
                update_fields.append('media_file')
                _delete_thumbnails(media_file_path)
            else:
                errors = True
                logging.error(
                    f'File {attachment.media_file_basename} (#{attachment.pk}) '
                    f'could not be moved to {target_folder}'
                )

        attachment.user_id = transfer.invite.recipient.pk
        attachment.save(update_fields=update_fields)

        heartbeat = _update_heartbeat(heartbeat, transfer, async_task_type)

    if errors:
        raise AsyncTaskException('Some attachments could not be moved')

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
            for kc_file in MetaData.objects.filter(
                xform_id=transfer.asset.deployment.xform.pk
            )
        }

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
            # There is no way to ensure atomicity when moving the file and saving the
            # object to the database. Fingers crossed that the process doesn't get
            # interrupted between these two operations.
            media_file.content.move(target_folder)
            old_md5 = media_file.metadata.pop('hash', None)
            media_file.set_md5_hash()
            media_file.save(update_fields=['content', 'metadata'])

            if old_md5 in kc_files.keys():
                kc_obj = kc_files[old_md5]
                if kc_target_folder := get_target_folder(
                    transfer.invite.sender.username,
                    transfer.invite.recipient.username,
                    kc_obj.data_file.name,
                ):
                    kc_obj.data_file.move(kc_target_folder)
                    kc_obj.file_hash = media_file.md5_hash
                    kc_obj.save(update_fields=['file_hash', 'data_file'])

            heartbeat = _update_heartbeat(heartbeat, transfer, async_task_type)

    _mark_task_as_successful(transfer, async_task_type)


def rewrite_mongo_userform_id(transfer: 'project_ownership.Transfer'):
    old_owner = transfer.invite.sender

    if not transfer.asset.has_deployment:
        return

    transfer.asset.deployment.set_mongo_uuid()

    if not transfer.asset.deployment.transfer_submissions_ownership(
        old_owner.username
    ):
        raise AsyncTaskException(
            'Could not rewrite MongoDB `_userform_id` successfully'
        )

    _mark_task_as_successful(
        transfer, TransferStatusTypeChoices.SUBMISSIONS
    )


def update_invite(
    invite: Union['Invite', 'OrgMembershipAutoInvite'],
    status: str,
) -> Union['Invite', 'OrgMembershipAutoInvite']:

    # Keep `status` value to email condition below
    invite.status = (
        InviteStatusChoices.IN_PROGRESS
        if status == InviteStatusChoices.ACCEPTED
        else status
    )
    invite.save(update_fields=['status', 'date_modified'])

    for transfer in invite.transfers.all():
        if invite.status != InviteStatusChoices.IN_PROGRESS:
            transfer.statuses.update(status=TransferStatusChoices.CANCELLED)
        else:
            transfer.transfer_project()

    if not invite.auto_accept_invites:
        if status == InviteStatusChoices.DECLINED:
            invite.send_refusal_email()
        elif status == InviteStatusChoices.ACCEPTED:
            invite.send_acceptance_email()

    return invite


def _mark_task_as_successful(
    transfer: 'project_ownership.Transfer', async_task_type: str
):
    TransferStatus = apps.get_model('project_ownership', 'TransferStatus')  # noqa
    TransferStatus.update_status(
        transfer.pk, TransferStatusChoices.SUCCESS, async_task_type
    )


def _delete_thumbnails(media_file_path: str):
    """
    Delete generated thumbnail files (large, medium, small) that correspond to
    an original attachment.

    Thumbnails are not stored in the database and are generated on the fly
    when a user previews an image. Since they will be regenerated for the new
    owner after transfer, we safely delete them from the old owner's folder
    after moving the original attachment.
    """
    if not media_file_path:
        return

    dir_name = os.path.dirname(media_file_path)
    base, ext = os.path.splitext(os.path.basename(media_file_path))

    for size_key in settings.THUMB_CONF.keys():
        thumb_path = os.path.join(dir_name, f'{base}-{size_key}{ext}')
        if default_kobocat_storage.exists(thumb_path):
            try:
                default_kobocat_storage.delete(thumb_path)
            except Exception as e:
                logging.warning(f'Could not delete thumbnail: {thumb_path} ({e})')


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
