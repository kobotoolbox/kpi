from __future__ import annotations

from django.db import models, transaction
from django.utils import timezone

from kpi.constants import PERM_MANAGE_ASSET
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.exceptions import DeploymentNotFound
from kpi.fields import KpiUidField
from .invite import Invite
from ..exceptions import MongoUserFormIdRewriteException


class TransferStatus(models.TextChoices):

    CANCELLED = 'cancelled', 'CANCELLED'
    FAILED = 'failed', 'FAILED'
    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'
    SUCCESS = 'success', 'SUCCESS'


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

    class Meta:
        verbose_name = 'project ownership transfer'

    def __str__(self) -> str:
        return f'{self.asset}'

    def save(self, *args, **kwargs):

        update_fields = kwargs.get('update_fields', [])

        if not update_fields or 'date_modified' in update_fields:
            self.date_modified = timezone.now()

        super().save(*args, **kwargs)

    def process(self):
        if self.status != TransferStatus.PENDING:
            return

        self.status = TransferStatus.IN_PROGRESS
        self.save(update_fields=['status', 'date_modified'])
        new_owner = self.invite.destination_user

        try:
            if not self.asset.deployment.transfer_submissions_ownership(
                new_owner.username
            ):
                raise MongoUserFormIdRewriteException
        except DeploymentNotFound:
            pass

        with transaction.atomic():
            if not self.asset.has_deployment:
                self._reassign_project_permissions(redeploy=False)
            else:
                with kc_transaction_atomic():
                    with self.asset.deployment.suspend_submissions(
                        [self.asset.owner_id, new_owner.pk]
                    ):
                        # Update counters
                        self.asset.deployment.transfer_counters_ownership(new_owner)
                        self._reassign_project_permissions(redeploy=True)

                        # move XLS form
                        # change EE form

                        # Create In-App Message
                        # - `kobocat.main_userprofile`

                        self.status = TransferStatus.SUCCESS
                        self.save(update_fields=['status', 'date_modified'])

    def _reassign_project_permissions(self, redeploy: bool = False):
        new_owner = self.invite.destination_user

        # Delete existing new owner's permissions on project if any
        self.asset.permissions.filter(user=new_owner).delete()
        self.asset.owner = new_owner

        if redeploy:
            self.asset.deployment.xform.user_id = new_owner.pk
            self.asset.deployment.xform.save(update_fields=['user_id'])
            backend_response = self.asset.deployment.backend_response
            backend_response['owner'] = new_owner.username

        self.asset.save(
            update_fields=['owner', '_deployment_data'],
            create_version=False,
            adjust_content=False,
        )
        self.asset.assign_perm(
            self.invite.source_user, PERM_MANAGE_ASSET
        )
