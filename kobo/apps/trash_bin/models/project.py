from __future__ import annotations

from django.db import models, transaction
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.logger.utils.attachment import (
    update_user_attachment_storage_counters
)
from kobo.apps.project_ownership.models import Invite, InviteStatusChoices, Transfer
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.fields import KpiUidField
from kpi.models.asset import Asset, AssetDeploymentStatus
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes
from . import BaseTrash
from ..type_aliases import UpdatedQuerySetAndCount


class ProjectTrash(BaseTrash):

    uid = KpiUidField(uid_prefix='pt')
    asset = models.OneToOneField(
        'kpi.Asset', related_name='trash', on_delete=models.CASCADE
    )

    class Meta(BaseTrash.Meta):
        verbose_name = 'project'
        verbose_name_plural = 'projects'

    def __str__(self) -> str:
        return f'{self.asset} - {self.periodic_task.clocked.clocked_time}'

    @classmethod
    def toggle_statuses(
        cls,
        object_identifiers: list[str],
        active: bool = True,
        toggle_delete: bool = True,
    ) -> UpdatedQuerySetAndCount:
        """
        Toggle statuses of projects based on their `uid`.

        Args:
            object_identifiers (list[str]): List of project UIDs to toggle.
            active (bool): If True, the projects are activated/untrashed;
                           if False, they are deactivated/trashed.
            toggle_delete (bool): If True, the projects are marked for
                                  trashing/restoring; if False, the projects are
                                  marked for archived/unarchived.

        - If `active` is False and `toggle_delete` is False, the assets are archived.
        - If `active` is False and `toggle_delete` is True, the assets are marked
          for deletion/trashed.
        - If `active` is True and `toggle_delete` is False, the assets are unarchived.
        - If `active` is True and `toggle_delete` is True, the assets are untrashed.
        """

        kc_filter_params = {'kpi_asset_uid__in': object_identifiers}
        filter_params = {'uid__in': object_identifiers}

        kc_update_params = {'downloadable': active}
        update_params = {
            '_deployment_data': UpdateJSONFieldAttributes(
                '_deployment_data',
                updates={'active': active},
            ),
            '_deployment_status': (
                AssetDeploymentStatus.DEPLOYED
                if active
                else AssetDeploymentStatus.ARCHIVED
            ),
            'date_modified': timezone.now(),
        }

        if toggle_delete:
            kc_update_params['pending_delete'] = not active
            update_params['pending_delete'] = not active

        should_update_attachment_storage = False
        with transaction.atomic():
            with kc_transaction_atomic():
                # Deployment back end should be per asset. But, because we need
                # to do a bulk action, we assume that all `Asset` objects use the
                # same back end to avoid looping on each object to update their
                # back end.
                queryset = Asset.all_objects.filter(**filter_params)
                updated = queryset.update(
                    **update_params
                )

                if toggle_delete:
                    if not active:
                        Invite.objects.filter(
                            pk__in=Transfer.objects.filter(
                                asset_id__in=queryset.values_list('pk', flat=True),
                                invite__status=InviteStatusChoices.PENDING,
                            ).values_list('invite_id', flat=True)
                        ).update(status=InviteStatusChoices.CANCELLED)
                    should_update_attachment_storage = True

                kc_updated = XForm.all_objects.filter(**kc_filter_params).update(
                    **kc_update_params
                )
                if should_update_attachment_storage:
                    # We defer user storage counter updates to run at the end of
                    # the transaction block to avoid holding row-level locks on
                    # UserProfile for the full duration of the transaction. This
                    # helps reduce contention when multiple projects are being
                    # trashed or restored concurrently by different users.
                    update_user_attachment_storage_counters(
                        object_identifiers, subtract=not active
                    )
                assert updated >= kc_updated
        return queryset, updated
