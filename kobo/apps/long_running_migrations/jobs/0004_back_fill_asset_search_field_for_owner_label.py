# Generated on 2024-12-19 15:34
from django.db.models import Prefetch
from more_itertools import chunked

from kobo.apps.organizations.models import Organization
from kpi.models.asset import Asset


def run():
    """
    Transfers all assets owned by members to their respective organizations.
    """
    CHUNK_SIZE = 2000

    assets = (
        Asset.objects.only('search_field', 'name', 'uid', 'owner')
        .exclude(search_field__has_keys='owner_username')
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
    ).iterator(CHUNK_SIZE)

    for asset_batch in chunked(assets, CHUNK_SIZE):
        for asset in asset_batch:
            try:
                organization_name = asset.owner.organizations[0].name
            except IndexError:
                organization_name = f'{asset.owner.username}’s organization'

            asset.update_search_field(
                owner_username=asset.owner.username,
                organization_name=organization_name,
            )

        Asset.objects.bulk_update(asset_batch, fields=['search_field'])
