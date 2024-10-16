from __future__ import annotations

from django.conf import settings
from django.db import models, transaction
from django.utils.timezone import now

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.project_ownership.models import Invite, InviteStatusChoices, Transfer
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.fields import KpiUidField
from kpi.models.asset import Asset, AssetDeploymentStatus
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes
from . import BaseTrash


class ProjectTrash(BaseTrash):

    uid = KpiUidField(uid_prefix='pt')
    asset = models.OneToOneField(
        'kpi.Asset', related_name='trash', on_delete=models.CASCADE
    )

    class Meta(BaseTrash.Meta):
        verbose_name = 'project'
        verbose_name_plural = 'projects'

    def __str__(self) -> str:
        return f'{self.asset} - {self.periodic_task.start_time}'

    @classmethod
    def toggle_asset_statuses(
        cls,
        asset_uids: list[str] = None,
        owner: settings.AUTH_USER_MODEL = None,
        active: bool = True,
        toggle_delete: bool = True,
    ) -> tuple:

        if asset_uids and owner:
            raise ValueError(
                '`asset_uids` and `owner` cannot be passed at the time'
            )

        if asset_uids:
            kc_filter_params = {'kpi_asset_uid__in': asset_uids}
            filter_params = {'uid__in': asset_uids}
        else:
            kc_filter_params = {'user_id': owner.pk}
            filter_params = {'owner': owner}

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
            'date_modified': now(),
        }

        if toggle_delete:
            kc_update_params['pending_delete'] = not active
            update_params['pending_delete'] = not active

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

                if toggle_delete and not active:
                    Invite.objects.filter(
                        pk__in=Transfer.objects.filter(
                            asset_id__in=queryset.values_list('pk', flat=True),
                            invite__status=InviteStatusChoices.PENDING,
                        ).values_list('invite_id', flat=True)
                    ).update(status=InviteStatusChoices.CANCELLED)

                if not settings.TESTING:
                    kc_updated = XForm.objects.filter(**kc_filter_params).update(
                        **kc_update_params
                    )
                    assert updated >= kc_updated

        return queryset, updated
