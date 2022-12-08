# coding: utf-8
from __future__ import annotations

from django.db.models import Q
from rest_framework.request import Request

from kobo.apps.project_views.models.project_view import ProjectView
from kobo.apps.project_views.models.assignment import Assignment


def get_asset_countries(asset: 'models.Asset') -> List[str]:
    """
    Returns a list of country values (codes) specfied in the Asset.settings

    If the 'country' key exists in Asset.settings, it may look like either:
        - Current structure: [{'value': 'ZAF', 'label': 'South Africa'}]
    or:
        - Legacy: {'value': 'ZAF', 'label': 'South Africa'}
    """
    countries = asset.settings.get('country')
    if countries is not None and isinstance(countries, list):
        return [c['value'] for c in countries]
    return [countries['value']] if countries else []


def get_regional_user_permissions_for_asset(
    asset: 'models.Asset', user: 'auth.User'
) -> List[str]:
    """
    Returns a flat list of permissions the user has available for a specified
    asset within a region
    """

    asset_countries = get_asset_countries(asset)

    q = Q(countries__contains='*')
    for country in asset_countries:
        q |= Q(countries__contains=country)
    perms = list(
        ProjectView.objects.filter(q, users=user).values_list(
            'permissions', flat=True
        )
    )
    return list(set(p for np in perms for p in np))


def user_has_regional_asset_perm(
    asset: 'models.Asset', user: 'auth.User', perm: str
) -> bool:
    """
    Returns True if user has specified permission for asset within region if
    not explicitly granted through Asset.assign_perm()
    """
    return perm in get_regional_user_permissions_for_asset(asset, user)


def user_has_view_perms(user: 'auth.User', view: str) -> bool:
    """
    Returns True if user has any permissions permission to a specified view
    """
    return ProjectView.objects.filter(uid=view, users=user).exists()


def view_has_perm(view: str, perm: str) -> bool:
    """
    Returns True if a view has a specified permission associated with it
    """
    return ProjectView.objects.filter(
        uid=view, permissions__contains=[perm]
    ).exists()


def get_region_for_view(view: str) -> List[str]:
    """
    Returns list of county codes for a specified view id
    """
    return ProjectView.objects.get(uid=view).get_countries()


def get_regional_views_for_user(user: 'auth.User') -> List[ProjectView]:
    """
    Returns a list of all available regional views for a user
    """
    return list(ProjectView.objects.filter(users=user))
