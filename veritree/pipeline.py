from django.contrib.auth.models import User
from kobo.settings.base import ANONYMOUS_USER_ID

from kpi.constants import PERM_ADD_SUBMISSIONS, PERM_VIEW_ASSET, PERM_DISCOVER_ASSET, ASSET_TYPE_COLLECTION
from kpi.models import Asset, UserAssetSubscription
from veritree.models import Organization
from kpi.models import ObjectPermission

def get_all_org_members(org):
    """
    Util function for syncing an asset with all active members of an organization
    To be used ideally for when a new form is created/deployed and we need to now create
    permissions for this asset for all users that currently belong to the organization

    :return: None
    """
    if not org:
        return []
    
    # Get all users in the DB that have the organization id in their social data
    # TODO: Improve this query and loop
    veritree_users = User.objects.filter(social_auth__provider='veritree')
    org_users = []
    for user in veritree_users:
        extra_data = user.social_auth.get(provider='veritree').extra_data

        try:
            user_orgs = extra_data['user_orgs']
        except KeyError:
            pass
        try:
            if user_orgs and len(user_orgs) > 0:
                for user_org in user_orgs:
                    if org.veritree_id == user_org['org_id']:
                        org_users.append(user)
        except TypeError:
            pass
        except AttributeError:
            pass
    return org_users

def veritree_org_sync(backend, user, response, *args, **kwargs):
    user_orgs = kwargs['details']['user_orgs']

    if user_orgs and len(user_orgs) > 0:
        for org in user_orgs:
            try:
                veritree_org, created = Organization.objects.get_or_create(
                    veritree_id=org['org_id'],
                    name=org['org']['name'],
                    org_type=org['org']['org_type']
                )
                if not created:
                    veritree_org_sync_all_assets(user, veritree_org)
            except KeyError:
                pass

def veritree_org_sync_all_assets(user, org):
    """
    Util function for giving permission for all organizations assets to
    org members

    :return: None
    """
    if not org or not user:
        return

    for asset in org.assets.all():
        veritree_org_asset_sync(user, asset)

def veritree_org_asset_sync(user, asset):
    """
    Util function for giving permissions to organization members

    :return: None
    """
    if not asset or not user:
        return
    permission_codenames = [PERM_VIEW_ASSET, PERM_ADD_SUBMISSIONS]
        # Check for existing asset permissions on the asset
    permission_set = ObjectPermission.objects.filter(user=user, asset=asset)

    # Only sync if permissions do not already exist for this user and asset combo
    if not permission_set.exists():
        for codename in permission_codenames:
            asset.assign_perm(user, codename)

    return

def veritree_org_asset_sync_with_all_active_members(asset, org):
    """
    Util function for syncing an asset with all active members of an organization
    To be used ideally for when a new form is created/deployed and we need to now create
    permissions for this asset for all users that currently belong to the organization

    :return: None
    """
    if not org or not asset:
        return
    
    org_users = get_all_org_members(org)
    
    for org_user in org_users:
        veritree_org_sync_all_assets(org_user, org)

def veritree_org_asset_unlink_with_all_active_members(asset, org):
    """
    Util function for syncing an asset with all active members of an organization
    To be used ideally for when a new form is created/deployed and we need to now create
    permissions for this asset for all users that currently belong to the organization

    :return: None
    """
    if not org or not asset:
        return
    
    org_users = get_all_org_members(org)

    for org_user in org_users:
        veritree_org_asset_unlink(org_user, asset)

def veritree_org_asset_unlink(user, asset):
    if not user or not asset:
        return
    
    if asset.owner == user:
        # Don't unlink the owner ever at anytime
        return
    
    ObjectPermission.objects.filter(asset=asset, user=user).delete()

def veritree_subscribe_public_collections(backend, user, response, *args, **kwargs):
    """
    Pipeline function to auto-subscribe each user to the Veritree Public Collections
    So the user does not have to remember to do this. Helps new users get accustomed to the platform
    """
    veritree_collections = Asset.objects.filter(
            asset_type=ASSET_TYPE_COLLECTION, settings__organization='Veritree',
            permissions__user_id=ANONYMOUS_USER_ID,
            permissions__permission__codename=PERM_DISCOVER_ASSET
        )

    for veritree_collection in veritree_collections:
        UserAssetSubscription.objects.get_or_create(user=user, asset=veritree_collection)
    