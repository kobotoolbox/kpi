from __future__ import annotations

from datetime import timedelta
from typing import Optional, Union

from constance import config
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as t

from kobo.apps.help.models import InAppMessage, InAppMessageUsers
from kobo.apps.organizations.utils import get_real_owner
from kpi.constants import PERM_MANAGE_ASSET
from kpi.deployment_backends.kc_access.utils import (
    assign_applicable_kc_permissions,
    kc_transaction_atomic,
    reset_kc_permissions,
)
from kpi.fields import KpiUidField
from kpi.models import Asset, ObjectPermission
from kpi.models.abstract_models import AbstractTimeStampedModel

from ..exceptions import TransferAlreadyProcessedException
from ..tasks import async_task, send_email_to_admins
from ..utils import get_target_folder
from .choices import (
    InviteStatusChoices,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)
from .invite import Invite, InviteType, OrgMembershipAutoInvite


class Transfer(AbstractTimeStampedModel):

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
    # The `invite_type` field is **always** copied from the `Invite` model during the
    # save process to eliminate the need to load the related `Invite` model solely to
    # determine its type.
    # This optimization allows directly resolving the appropriate model with
    # `get_invite_model()`.
    invite_type = models.CharField(
        choices=InviteType.choices,
        default=InviteType.USER_OWNERSHIP_TRANSFER,
        max_length=30,
    )

    class Meta:
        verbose_name = 'project ownership transfer'

    def __str__(self) -> str:
        return (
            f'{self.asset}: '
            f'{self.invite.sender.username} -> '
            f'{self.invite.recipient.username}'
        )

    def get_invite_model(self) -> Invite | OrgMembershipAutoInvite:
        if self.invite_type == InviteType.USER_OWNERSHIP_TRANSFER:
            return Invite
        if self.invite_type == InviteType.ORG_MEMBERSHIP:
            return OrgMembershipAutoInvite

        raise NotImplementedError

    def save(self, *args, **kwargs):

        is_new = self.pk is None
        self.invite_type = self.invite.invite_type
        super().save(*args, **kwargs)

        if is_new:
            self._init_statuses()

    @property
    def status(self):
        return self.statuses.get(
            status_type=TransferStatusTypeChoices.GLOBAL
        ).status

    @status.setter
    def status(self, value: Union[str, tuple[str]]):
        with transaction.atomic():
            global_status = self.statuses.select_for_update().get(
                status_type=TransferStatusTypeChoices.GLOBAL
            )
            if isinstance(value, tuple):
                global_status.status = value[0]
                global_status.error = value[1]
            else:
                global_status.status = value

            global_status.save()

            self.date_modified = timezone.now()
            self.save(update_fields=['date_modified'])
            self._update_invite_status()

    def transfer_project(self):
        if self.status != TransferStatusChoices.PENDING:
            raise TransferAlreadyProcessedException()

        self.status = TransferStatusChoices.IN_PROGRESS
        new_owner = get_real_owner(self.invite.recipient)
        success = False
        try:
            if not self.asset.has_deployment:
                _rewrite_mongo = False
                with transaction.atomic():
                    self._reassign_project_permissions(update_deployment=False)
                    self._sent_in_app_messages()
                    # Draft projects do not have submissions or attachments to
                    # sync, set them to success right away
                    status_types = [
                        TransferStatusTypeChoices.SUBMISSIONS,
                        TransferStatusTypeChoices.ATTACHMENTS,
                    ]
                    self.statuses.filter(status_type__in=status_types).update(
                        status=TransferStatusChoices.SUCCESS
                    )
            else:
                _rewrite_mongo = True
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

                        self._sent_in_app_messages()

            # Do not delegate anything to Celery before the transaction has
            # been validated. Otherwise, Celery could fetch outdated data.
            transaction.on_commit(lambda: self._start_async_jobs(_rewrite_mongo))
            success = True
        finally:
            if not success:
                # We do not know which error has been raised, so no logs are
                # saved. Sentry is our friend to find out what's going on.
                self.status = (
                    TransferStatusChoices.FAILED,
                    'Error occurred while processing transfer',
                )

    def _init_statuses(self):
        TransferStatus.objects.bulk_create(
            [
                TransferStatus(transfer=self, status_type=type_)
                for type_ in TransferStatusTypeChoices.values
            ],
            ignore_conflicts=True,
        )

    def _reassign_project_permissions(self, update_deployment: bool = False):
        new_owner = get_real_owner(self.invite.recipient)

        # Delete existing new owner's permissions on the project if any
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
            # Kobocat adds 3 more permissions that KPI ignores:
            # - add_xform
            # - transfer_xform
            # - move_xform
            # There are not transferred since they are not used anymore by KoboCAT,
            # and it does not break anything.
            assign_applicable_kc_permissions(self.asset, new_owner, owner_perms)
            reset_kc_permissions(self.asset, old_owner)

            backend_response = self.asset.deployment.backend_response
            backend_response['owner'] = new_owner.username
            self.asset.deployment.store_data(
               {'backend_response': backend_response}
            )

        self.asset.update_search_field(
            owner_username=new_owner.username,
            organization_name=new_owner.organization.name,
        )

        self.asset.save(
            update_fields=['owner', '_deployment_data', 'search_field'],
            create_version=False,
            adjust_content=False,
        )
        self.asset.assign_perm(
            self.invite.sender, PERM_MANAGE_ASSET
        )
        # If the new owner differs from the user who accepted the invite,
        # let's give them 'manage_asset' permission as well.
        if new_owner != self.invite.recipient:
            self.asset.assign_perm(
                self.invite.recipient, PERM_MANAGE_ASSET
            )

    def _sent_in_app_messages(self):

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
            'they are changed.'
        )

        exclusions = [
            settings.ANONYMOUS_USER_ID,
            self.invite.sender.pk,
            self.invite.recipient.pk,
        ]

        message_recipient_ids = (
            ObjectPermission.objects.filter(asset_id=self.asset_id)
            .exclude(user_id__in=exclusions)
            .values_list('user_id', flat=True)
        )

        if len(message_recipient_ids):
            transfer_identifier = (
                f'{Transfer._meta.app_label}.{Transfer._meta.model_name}'
            )
            in_app_message = InAppMessage.objects.create(
                #  … save raw strings into DB to let them be translated in
                # the users' language in the API response, i.e. when front end
                # exposes the message in the UI.
                title=title._proxy____args[0],  # noqa
                snippet=snippet._proxy____args[0],  # noqa
                body=body._proxy____args[0],  # noqa
                published=True,
                valid_from=timezone.now(),
                valid_until=timezone.now()
                + timedelta(days=config.PROJECT_OWNERSHIP_IN_APP_MESSAGES_EXPIRY),
                last_editor=self.invite.sender,
                generic_related_objects={transfer_identifier: self.pk},
            )

            InAppMessageUsers.objects.bulk_create(
                [
                    InAppMessageUsers(user_id=user_id, in_app_message=in_app_message)
                    for user_id in message_recipient_ids
                ]
            )

    def _start_async_jobs(self, rewrite_mongo: bool = True):
        # Move submissions, media files and attachments in background
        # tasks because it can take a while to complete on big projects
        if rewrite_mongo:
            # 1) Rewrite `_userform_id` in MongoDB
            async_task.delay(self.pk, TransferStatusTypeChoices.SUBMISSIONS)

        # 2) Move media files to new owner's home directory
        async_task.delay(self.pk, TransferStatusTypeChoices.MEDIA_FILES)

    def _update_invite_status(self):
        """
        Update the status of the invite based on the status of each transfer

        This method must be called within a transaction because of the lock
        acquired the object row (with `select_for_update`)
        """
        invite = (
            self.get_invite_model().objects.select_for_update().get(pk=self.invite_id)
        )
        previous_status = invite.status
        is_complete = True

        # One of the transfers has begun, mark the invite as `in_progress`
        if invite.status == InviteStatusChoices.PENDING:
            invite.status = InviteStatusChoices.IN_PROGRESS

        for transfer in invite.transfers.all():
            if transfer.status == TransferStatusChoices.FAILED:
                invite.status = InviteStatusChoices.FAILED
                is_complete = False
                break
            elif transfer.status != TransferStatusChoices.SUCCESS:
                is_complete = False

        if is_complete:
            invite.status = InviteStatusChoices.COMPLETE

        if previous_status != invite.status:
            invite.date_modified = timezone.now()
            invite.save(update_fields=['status', 'date_modified'])
            if invite.status == InviteStatusChoices.FAILED:
                send_email_to_admins.delay(invite.uid)

            self.invite.status = invite.status
            self.invite.date_modified = invite.date_modified


class TransferStatus(AbstractTimeStampedModel):

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
            if status != TransferStatusChoices.IN_PROGRESS:
                transfer_status.update_transfer_status()

    def update_transfer_status(self):
        success = True
        for status_ in self.transfer.statuses.exclude(
            status_type=TransferStatusTypeChoices.GLOBAL
        ):
            if status_.status == TransferStatusChoices.FAILED:
                self.transfer.status = (status_.status, status_.error)
                return
            elif status_.status != TransferStatusChoices.SUCCESS:
                success = False
                continue

        if success:
            self.transfer.status = TransferStatusChoices.SUCCESS
