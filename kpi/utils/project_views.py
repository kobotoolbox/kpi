from __future__ import annotations

from typing import Union

from django.conf import settings
from django_request_cache import cache_for_request

from kobo.apps.project_views.models import ProjectView
from kpi.utils.object_permission import get_database_user


@cache_for_request
def get_project_view_user_permissions_for_asset(
    asset: 'models.Asset', user: Union[settings.AUTH_USER_MODEL, 'auth.AnonymousUser']
) -> list[str]:
    """
    Returns a flat list of permissions the user has available for a specified
    asset within a project view
    """

    user = get_database_user(user)
    asset_org = (
        asset.owner.organization.id
        if asset.owner and asset.owner.organization
        else None
    )
    asset_countries = asset.settings.get('country_codes', [])

    project_views = ProjectView.objects.filter(users=user).prefetch_related(
        'organizations'
    )
    perms = set()

    for pv in project_views:
        region = pv.get_countries()

        if '*' not in region and not any(c in region for c in asset_countries):
            continue

        if pv.organizations.all() and asset_org not in [
            org.id for org in pv.organizations.all()
        ]:
            continue

        perms.update(pv.permissions)

    return list(perms)


@cache_for_request
def user_has_project_view_asset_perm(
    asset: 'models.Asset',
    user: Union[settings.AUTH_USER_MODEL, 'auth.AnonymousUser'],
    perm: str,
) -> bool:
    """
    Returns True if user has specified permission for asset within project view
    if not explicitly granted through Asset.assign_perm()
    """
    if not asset:
        return False
    return perm in get_project_view_user_permissions_for_asset(asset, user)


@cache_for_request
def user_has_view_perms(user: settings.AUTH_USER_MODEL, view: str) -> bool:
    """
    Returns True if user has any permissions permission to a specified view
    """
    return ProjectView.objects.filter(uid=view, users=user).exists()


@cache_for_request
def view_has_perm(view: str, perm: str) -> bool:
    """
    Returns True if a view has a specified permission associated with it
    """
    return ProjectView.objects.filter(
        uid=view, permissions__contains=[perm]
    ).exists()


@cache_for_request
def get_region_for_view(view: str) -> list[str]:
    """
    Returns list of county codes for a specified view id
    """
    return ProjectView.objects.get(uid=view).get_countries()
