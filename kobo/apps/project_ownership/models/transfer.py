from __future__ import annotations

import os
from typing import Optional

from django.db import models, transaction
from django.utils import timezone

from kpi.constants import PERM_MANAGE_ASSET
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.fields import KpiUidField
from kpi.utils.django_orm_helper import ReplaceValues
from kpi.utils.log import logging
from .choices import TransferAsyncTask, TransferStatus
from .invite import Invite
from ..tasks import async_task


def default_errors_dict():
    _default_dict = {'global': ''}
    for value in TransferAsyncTask.values:
        _default_dict[value] = ''
    return _default_dict


class Transfer(models.Model):

    uid = KpiUidField(uid_prefix='pot')
    asset = models.ForeignKey(
        'kpi.Asset',
        related_name='transfers',
        on_delete=models.CASCADE,
    )
    invite = models.ForeignKey(
        Invite, related_name='transfers', on_delete=models.CASCADE
    )
    status = models.CharField(
        max_length=11,
        choices=TransferStatus.choices,
        default=TransferStatus.PENDING,
        db_index=True
    )
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)
    errors = models.JSONField(default=default_errors_dict)
    async_task_statuses = models.JSONField(default=TransferAsyncTask.default_statuses_dict)

    class Meta:
        verbose_name = 'project ownership transfer'

    def __str__(self) -> str:
        return (
            f'{self.asset}: '
            f'{self.invite.source_user.username} -> '
            f'{self.invite.destination_user.username}'
        )

    def calculate_global_status(self):
        for value in TransferAsyncTask.values:
            if self.async_task_statuses[value] == TransferStatus.FAILED.value:
                self.status = TransferStatus.FAILED.value
                return
            elif self.async_task_statuses[value] != TransferStatus.SUCCESS.value:
                return

        self.status = TransferStatus.SUCCESS.value

    def process(self):
        if self.status != TransferStatus.PENDING.value:
            return

        with transaction.atomic():
            transfer = self.__class__.objects.select_for_update().get(
                pk=self.pk
            )
            transfer.status = TransferStatus.IN_PROGRESS.value
            transfer.save(
                update_fields=['status', 'date_modified']
            )

            self.refresh_from_db()

        success = False
        new_owner = self.invite.destination_user

        try:
            if not self.asset.has_deployment:
                with transaction.atomic():
                    self._reassign_project_permissions(update_deployment=False)
            else:
                with transaction.atomic():
                    with kc_transaction_atomic():
                        with self.asset.deployment.suspend_submissions(
                            [self.asset.owner_id, new_owner.pk]
                        ):
                            # Update counters
                            self.asset.deployment.transfer_counters_ownership(
                                new_owner
                            )
                            self._reassign_project_permissions(
                                update_deployment=True
                            )

                # Run background tasks.
                # 1) Rewrite `_userform_id` in MongoDB
                async_task.delay(
                    transfer.pk, TransferAsyncTask.SUBMISSIONS.value
                )

                # 2) Move media files to new owner's home directory
                async_task.delay(
                    transfer.pk, TransferAsyncTask.MEDIA_FILES.value
                )

                # 2) Move attachments to new owner's home directory
                async_task.delay(
                    transfer.pk, TransferAsyncTask.ATTACHMENTS.value
                )

            success = True
        finally:
            if not success:
                # We do not know which error has been raised, so no logs are
                # saved. Sentry is our friend to find out what's going on.
                Transfer.objects.filter(pk=self.pk).update(
                    date_modified=timezone.now(),
                    status=TransferStatus.FAILED.value,
                    errors=ReplaceValues(
                        'errors',
                        updates={
                            'global': 'Error occurred while processing transfer'
                        }
                    )
                )
                self.refresh_from_db()

    def save(self, *args, **kwargs):

        update_fields = kwargs.get('update_fields', [])
        update_invite_status = False

        if not update_fields or 'date_modified' in update_fields:
            self.date_modified = timezone.now()

        if not update_fields or 'async_task_statuses' in update_fields:
            update_invite_status = True
            self.calculate_global_status()

        super().save(*args, **kwargs)

        if (
            not update_fields
            or 'status' in update_fields
            or update_invite_status
        ):
            self.invite.update_status()

    @classmethod
    def update_statuses(
        cls,
        transfer_id: int,
        status: str,
        async_task_type: str,
        exception: Optional[str],
    ):

        with transaction.atomic():
            # Lock row to ensure status and errors are logged properly
            transfer = cls.objects.select_for_update().get(pk=transfer_id)
            transfer.async_task_statuses[async_task_type] = status
            transfer.calculate_global_status()
            errors = {}
            if exception:
                errors = {
                    'errors': ReplaceValues(
                        'errors',
                        updates={async_task_type: exception}
                    ),
                }

            cls.objects.filter(pk=transfer_id).update(
                date_modified=timezone.now(),
                status=transfer.status,
                async_task_statuses=ReplaceValues(
                    'async_task_statuses',
                    updates={async_task_type: status}
                ),
                **errors
            )
            transfer.invite.update_status()

    def _reassign_project_permissions(self, update_deployment: bool = False):
        new_owner = self.invite.destination_user

        # Delete existing new owner's permissions on project if any
        self.asset.permissions.filter(user=new_owner).delete()
        old_owner = self.asset.owner
        self.asset.owner = new_owner

        if update_deployment:
            xform = self.asset.deployment.xform
            xform.user_id = new_owner.pk
            try:
                target_folder = os.path.dirname(
                    xform.xls.name.replace(
                        old_owner.username, new_owner.username
                    )
                )
            except FileNotFoundError:
                logging.error(
                    'File not found: Could not move Kobocat XLSForm',
                    exc_info=True,
                )
            else:
                xform.xls.move(target_folder)

            xform.save(update_fields=['user_id', 'xls'])
            backend_response = self.asset.deployment.backend_response
            backend_response['owner'] = new_owner.username
            self.asset.deployment.store_data(
               {'backend_response': backend_response}
            )

        self.asset.save(
            update_fields=['owner', '_deployment_data'],
            create_version=False,
            adjust_content=False,
        )
        self.asset.assign_perm(
            self.invite.source_user, PERM_MANAGE_ASSET
        )
