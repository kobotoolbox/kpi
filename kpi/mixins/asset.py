from collections import defaultdict
from django.db.models import Prefetch

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
                    queryset=Organization.objects.all().order_by(
                        '-organization_users__created'
                    ),
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
