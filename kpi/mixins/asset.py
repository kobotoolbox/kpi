from collections import defaultdict

from django.db.models import Prefetch

from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.organizations.models import Organization
from kpi.models.asset import Asset


class AssetViewSetListMixin:

    def get_organizations_per_asset_ids(self, asset_ids: list) -> dict:

        assets = (
            Asset.objects.only('owner', 'uid', 'name')
            .filter(id__in=asset_ids)
            .select_related('owner')
            .prefetch_related(
                Prefetch(
                    'owner__organizations_organization',
                    queryset=Organization.objects.all()
                    .select_related('owner__organization_user__user')
                    .order_by('-organization_users__created'),
                    to_attr='organizations',
                )
            )
        )
        organizations_per_asset = defaultdict(dict)
        for asset in assets:
            try:
                organizations_per_asset[asset.id] = asset.owner.organizations[0]
            except IndexError:
                pass

        return organizations_per_asset

    def get_mmo_organization_ids(self, organizations_per_asset: dict) -> set[str]:
        """
        Return the ids of the multi-member organizations of the page, so that the
        serializer does not run one query per organization
        """

        organizations = {
            organization.id: organization
            for organization in organizations_per_asset.values()
        }
        return Organization.get_mmo_ids(list(organizations.values()))

    def _attach_xforms_to_assets(self, assets: list):
        """
        Attach the related XForm to each deployed Asset with one query, instead
        of one query per Asset when the serializer reads its deployment.
        """

        asset_uids = [asset.uid for asset in assets if asset.has_deployment]
        xform_qs = (
            XForm.all_objects.filter(kpi_asset_uid__in=asset_uids)
            .only(
                'id_string',
                'num_of_submissions',
                'attachment_storage_bytes',
                'require_auth',
                'uuid',
                'mongo_uuid',
                'encrypted',
                'last_submission_time',
                'kpi_asset_uid',
            )
            .order_by()
        )

        xforms_by_uid = {xf.kpi_asset_uid: xf for xf in xform_qs}

        for asset in assets:
            if asset.has_deployment:
                if xf := xforms_by_uid.get(asset.uid):
                    xf.user = asset.owner
                    asset.deployment._xform = xf
                else:
                    # If XForm does not exist, something went wrong.
                    # Consider the asset as not deployed.
                    asset.date_deployed = None
                    asset._deployment_data = {}
