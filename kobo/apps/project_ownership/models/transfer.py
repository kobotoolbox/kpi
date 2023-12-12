from __future__ import annotations

import os
from typing import Optional, Union

from django.db import models, transaction
from django.utils import timezone

from kpi.constants import PERM_MANAGE_ASSET
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.fields import KpiUidField
from kpi.utils.log import logging
from .base import TimeStampedModel
from .choices import TransferStatusChoices, TransferStatusTypeChoices
from .invite import Invite
from ..exceptions import TransferAlreadyProcessedException
from ..tasks import async_task


class Transfer(TimeStampedModel):

    uid = KpiUidField(uid_prefix='pot')
    asset = models.ForeignKey(
        'kpi.Asset',
        related_name='transfers',
        on_delete=models.CASCADE,
    )
    invite = models.ForeignKey(
        Invite,
        related_name='transfers',
        on_delete=models.CASCADE,
    )

    class Meta:
        verbose_name = 'project ownership transfer'

    def __str__(self) -> str:
        return (
            f'{self.asset}: '
            f'{self.invite.source_user.username} -> '
            f'{self.invite.destination_user.username}'
        )

    def process(self):
        if self.status != TransferStatusChoices.PENDING.value:
            raise TransferAlreadyProcessedException()

        self.status = TransferStatusChoices.IN_PROGRESS.value
        new_owner = self.invite.destination_user

        success = False
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
                    self.pk, TransferStatusTypeChoices.SUBMISSIONS.value
                )

                # 2) Move media files to new owner's home directory
                async_task.delay(
                    self.pk, TransferStatusTypeChoices.MEDIA_FILES.value
                )

            success = True
        finally:
            if not success:
                # We do not know which error has been raised, so no logs are
                # saved. Sentry is our friend to find out what's going on.
                self.status = (
                    TransferStatus.FAILED.value,
                    'Error occurred while processing transfer',
                )

    def save(self, *args, **kwargs):

        is_new = self.pk is None

        super().save(*args, **kwargs)

        if is_new:
            self._init_statuses()

    @property
    def status(self):
        return self.statuses.get(
            status_type=TransferStatusTypeChoices.GLOBAL.value
        ).status

    @status.setter
    def status(self, value: Union[str, tuple[str]]):
        with transaction.atomic():
            global_status = self.statuses.select_for_update().get(
                status_type=TransferStatusTypeChoices.GLOBAL.value
            )
            if isinstance(value, tuple):
                global_status.status = value[0]
                global_status.error = value[1]
            else:
                global_status.status = value

            global_status.save()
            self.date_modified = timezone.now()
            self.save(update_fields=['date_modified'])
            self.invite.update_status_from_transfers()

    def _init_statuses(self):
        TransferStatus.objects.bulk_create(
            [
                TransferStatus(transfer=self, status_type=type_)
                for type_ in TransferStatusTypeChoices.values
            ],
            ignore_conflicts=True,
        )

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


class TransferStatus(TimeStampedModel):

    transfer = models.ForeignKey(
        Transfer, related_name='statuses', on_delete=models.CASCADE
    )
    status = models.CharField(
        max_length=11,
        choices=TransferStatusChoices.choices,
        default=TransferStatusChoices.PENDING,
        db_index=True
    )
    status_type = models.CharField(
        max_length=11,
        choices=TransferStatusTypeChoices.choices,
        default=TransferStatusTypeChoices.GLOBAL,
        db_index=True
    )
    error = models.TextField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['transfer', 'status_type'],
                name='uniq_transfer_status_type',
            )
        ]

    def __str__(self):
        return (
            f'Transfer #{self.transfer_id} '
            f'[{TransferStatusTypeChoices(self.status_type).label}]: '
            f'{TransferStatusChoices(self.status).label}'
        )

    @classmethod
    def update_status(
        cls,
        transfer_id: int,
        status: str,
        status_type: str,
        error: Optional[str] = None,
    ):
        with transaction.atomic():
            # Lock row to ensure status and errors are logged properly
            transfer_status = cls.objects.select_for_update().get(
                transfer_id=transfer_id, status_type=status_type
            )
            transfer_status.status = status
            transfer_status.error = error
            transfer_status.date_modified = timezone.now()
            transfer_status.save(
                update_fields=['status', 'error', 'date_modified']
            )

            # No need to update parent if `status` is still 'in_progress'
            if status != TransferStatusChoices.IN_PROGRESS.value:
                transfer_status.update_transfer_status()

    def update_transfer_status(self):
        success = True
        for status_ in self.transfer.statuses.exclude(
            status_type=TransferStatusTypeChoices.GLOBAL.value
        ):
            if status_.status == TransferStatusChoices.FAILED.value:
                self.transfer.status = (status_.status, status_.error)
                return
            elif status_.status != TransferStatusChoices.SUCCESS.value:
                success = False
                continue

        if success:
            self.transfer.status = TransferStatusChoices.SUCCESS.value
