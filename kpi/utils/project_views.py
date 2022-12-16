# coding: utf-8
from __future__ import annotations

from django.db.models import Q
from django_request_cache import cache_for_request

from kobo.apps.project_views.models import ProjectView


def get_regional_user_permissions_for_asset(
    asset: 'models.Asset', user: 'auth.User'
) -> list[str]:
    """
    Returns a flat list of permissions the user has available for a specified
    asset within a region
    """

    asset_countries = asset.settings.get('country_codes', [])

    q = Q(countries__contains='*')
    for country in asset_countries:
        q |= Q(countries__contains=country)
    perms = list(
        ProjectView.objects.filter(q, users=user).values_list(
            'permissions', flat=True
        )
    )
    return list(set(p for np in perms for p in np))


@cache_for_request
def user_has_regional_asset_perm(
    asset: 'models.Asset', user: 'auth.User', perm: str
) -> bool:
    """
    Returns True if user has specified permission for asset within region if
    not explicitly granted through Asset.assign_perm()
    """
    return perm in get_regional_user_permissions_for_asset(asset, user)


@cache_for_request
def user_has_view_perms(user: 'auth.User', view: str) -> bool:
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


@cache_for_request
def get_regional_views_for_user(user: 'auth.User') -> list[ProjectView]:
    """
    Returns a list of all available regional views for a user
    """
    return list(ProjectView.objects.filter(users=user))
