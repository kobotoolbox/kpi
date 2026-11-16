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
    asset_countries = asset.settings.get('country_codes', [])
    perms = set()

    for pv in _get_project_views_for_user(user):
        region = pv.get_countries()

        if '*' not in region and not any(c in region for c in asset_countries):
            continue

        organization_ids = [org.id for org in pv.organizations.all()]
        if organization_ids and (
            _get_owner_organization_id(asset) not in organization_ids
        ):
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


def _get_owner_organization_id(asset: 'models.Asset') -> str | None:
    """
    Return the id of the organization of the owner of `asset`. The serializers that
    list assets set `asset_ids_cache`, so that one query covers the whole page.
    """

    if asset_ids := getattr(asset, 'asset_ids_cache', None):
        return _get_owner_organization_ids(asset_ids).get(asset.owner_id)
    return asset.owner.organization.id if asset.owner else None


@cache_for_request
def _get_owner_organization_ids(asset_ids: list[int]) -> dict[int, str]:
    """
    Return the organization id of each owner of `asset_ids`, in one query.

    A user belongs to one organization at most, so each owner has a single entry.
    If users can join several organizations, this must return all of them.
    """

    # Avoid a circular import
    from kpi.models.asset import Asset

    return dict(
        Asset.objects.filter(pk__in=asset_ids)
        .order_by()
        .values_list(
            'owner_id', 'owner__organizations_organizationuser__organization_id'
        )
    )


@cache_for_request
def _get_project_views_for_user(user: settings.AUTH_USER_MODEL) -> list[ProjectView]:
    """
    Return the project views of `user` with their organizations, once per request
    whatever the number of assets that are checked against them
    """

    return list(
        ProjectView.objects.filter(users=user).prefetch_related('organizations')
    )
