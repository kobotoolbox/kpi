from __future__ import annotations

from datetime import timedelta
from typing import Optional, Union

from constance import config
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as t

from kobo.apps.help.models import InAppMessage, InAppMessageUsers
from kpi.constants import PERM_ADD_SUBMISSIONS, PERM_MANAGE_ASSET
from kpi.deployment_backends.kc_access.utils import (
    assign_applicable_kc_permissions,
    kc_transaction_atomic,
    reset_kc_permissions,
)
from kpi.fields import KpiUidField
from kpi.models import Asset, ObjectPermission
from .base import TimeStampedModel
from .choices import TransferStatusChoices, TransferStatusTypeChoices
from .invite import Invite
from ..exceptions import TransferAlreadyProcessedException
from ..tasks import async_task
from ..utils import get_target_folder


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
            f'{self.invite.sender.username} -> '
            f'{self.invite.recipient.username}'
        )

    def process(self):
        if self.status != TransferStatusChoices.PENDING.value:
            raise TransferAlreadyProcessedException()

        self.status = TransferStatusChoices.IN_PROGRESS.value
        new_owner = self.invite.recipient
        success = False
        try:
            if not self.asset.has_deployment:
                with transaction.atomic():
                    self._reassign_project_permissions(update_deployment=False)
            else:
                with transaction.atomic():
                    with kc_transaction_atomic():
                        deployment = self.asset.deployment
                        with deployment.suspend_submissions(
                            [self.asset.owner_id, new_owner.pk]
                        ):
                            # Update counters
                            deployment.transfer_counters_ownership(new_owner)
                            previous_owner_username = self.asset.owner.username
                            self._reassign_project_permissions(
                                update_deployment=True
                            )
                            deployment.rename_enketo_id_key(previous_owner_username)

                        self._sent_app_in_messages()

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
                    TransferStatusChoices.FAILED.value,
                    'Error occurred while processing transfer',
                )

    def save(self, *args, **kwargs):

        is_new = self.pk is None

        super().save(*args, **kwargs)

        if is_new:
            self._init_statuses()

    @property
    def status(self):
        if hasattr(self, 'prefetched_status'):
            return self.prefetched_status[0].status

        if hasattr(self, 'prefetched_statuses'):
            for status in self.prefetched_statuses:
                if status.status_type == TransferStatusTypeChoices.GLOBAL.value:
                    return status.status

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
        new_owner = self.invite.recipient

        # Delete existing new owner's permissions on project if any
        self.asset.permissions.filter(user=new_owner).delete()
        old_owner = self.asset.owner
        self.asset.owner = new_owner

        if update_deployment:
            owner_perms = [
                p.permission.codename
                for p in self.asset.permissions.filter(user=old_owner)
            ]
            # Add calculated permissions in case some of them match KC owner's
            # permissions
            owner_perms += list(Asset.CALCULATED_PERMISSIONS)
            xform = self.asset.deployment.xform
            xform.user_id = new_owner.pk
            if (
                target_folder := get_target_folder(
                    old_owner.username, new_owner.username, xform.xls.name
                )
            ):
                xform.xls.move(target_folder)

            xform.save(update_fields=['user_id', 'xls'])
            # TODO (or not)
            # KC usually adds 3 more permissions that are ignored by KPI:
            # - add_xform
            # - transfer_xform
            # - move_xform
            # It does not seem to be a problem, but would be worth it to make
            # permission assignments consistent.
            assign_applicable_kc_permissions(self.asset, new_owner, owner_perms)
            reset_kc_permissions(self.asset, old_owner)

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
            self.invite.sender, PERM_MANAGE_ASSET
        )

    def _sent_app_in_messages(self):

        # Use translatable strings here to let Transifex detect them but …
        title = t('Project ownership transferred')
        snippet = t(
            'Please note that the ownership of the project **##project_name##** '
            'has been transferred from **##previous_owner##** to **##new_owner##**.'
        )
        body = t(
            'Dear ##username##,\n\n'
            'Please note that the ownership of the project **##project_name##** '
            'has been transferred from **##previous_owner##** to **##new_owner##**.\n\n'
            'Note: You will continue to have the same project permissions until '
            'they are changed.\n\n'
            ' — Kobotoolbox'
        )

        in_app_message = InAppMessage.objects.create(
            #  … save raw strings into DB to let them be translated in
            # the users' language in the API response, i.e. when front end expose
            # the message in the UI.
            title=title._proxy____args[0],  # noqa
            snippet=snippet._proxy____args[0],  # noqa
            body=body._proxy____args[0],  # noqa
            published=True,
            valid_from=timezone.now(),
            valid_until=timezone.now()
            + timedelta(days=config.PROJECT_OWNERSHIP_APP_IN_MESSAGES_EXPIRY),
            last_editor=self.invite.sender,
            project_ownership_transfer=self,
        )

        InAppMessageUsers.objects.bulk_create(
            [
                InAppMessageUsers(
                    user_id=user_id, in_app_message=in_app_message
                )
                for user_id in ObjectPermission.objects.filter(
                    asset_id=self.asset_id
                ).values_list('user_id', flat=True)
                if user_id
                not in [self.invite.sender.pk, self.invite.recipient.pk]
            ]
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

            # TODO let sysadmin know something went south.

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
