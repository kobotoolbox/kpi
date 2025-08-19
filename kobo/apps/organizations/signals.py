from django.db.models.signals import post_save
from django.dispatch import receiver

from kobo.apps.organizations.models import Organization
from kpi.models.asset import Asset


@receiver(post_save, sender=Organization)
def update_asset_on_organization_name_change(sender, instance, **kwargs):
    """
    Bulk update `search_field` for all assets owned by users of the
    organization when the organization is saved (e.g., on name change).
    """

    organization = instance
    org_owner = organization.owner_user_object
    if org_owner is None:
        return

    assets = Asset.objects.only('pk', 'uid', 'search_field').filter(
        owner_id=org_owner.id
    )

    assets_to_update = []
    for asset in assets.iterator():
        asset.update_search_field(
            owner_username=org_owner.username,
            organization_name=organization.name,
        )
        assets_to_update.append(asset)

    Asset.objects.bulk_update(assets_to_update, fields=['search_field'])
