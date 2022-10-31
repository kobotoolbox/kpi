# coding: utf-8
import json
from dataclasses import dataclass
from typing import List, Union

import constance
from rest_framework.request import Request


class DataDict:
    def to_dict(self):
        return self.__dict__


@dataclass
class RegionalView(DataDict):
    id: int
    label: str
    countries: Union[str, List[str]]
    permissions: List[str]


@dataclass
class RegionalAssignment(DataDict):
    view: int
    username: str


def get_regional_assignments() -> List[RegionalAssignment]:
    """
    Returns a list of regional assignments defined constance.config
    """
    return [
        RegionalAssignment(**ra)
        for ra in json.loads(constance.config.REGIONAL_ASSIGNMENTS)
    ]


def get_regional_views() -> List[RegionalView]:
    """
    Returns a list of regional views defined constance.config
    """
    return [
        RegionalView(**rv) for rv in json.loads(constance.config.REGIONAL_VIEWS)
    ]


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


def get_regional_user_permissions(
    asset: 'models.Asset', user: 'auth.User'
) -> List[str]:
    """
    Returns a flat list of permissions the user has available for a specified
    asset within a region
    """

    asset_countries = get_asset_countries(asset)

    # views that asset is in
    views_for_asset = [
        view
        for view in get_regional_views()
        if (set(asset_countries) & set(view.countries))
        or ('*' == view.countries)
    ]
    if not views_for_asset:
        return []

    # view ids that user is in
    view_ids_for_user = [
        v.view
        for v in get_regional_assignments()
        if v.username == user.username
    ]
    if not view_ids_for_user:
        return []

    # views that both the user and asset are in
    views_for_user_and_asset = [
        v for v in views_for_asset if v.id in view_ids_for_user
    ]
    if not views_for_user_and_asset:
        return []

    # unique, flattened list of permissions for asset
    # [['p1'], ['p1', 'p2']] -> ['p1', 'p2']
    return list(
        set(perm for v in views_for_user_and_asset for perm in v.permissions)
    )


def user_has_regional_asset_perm(
    asset: 'models.Asset', user: 'auth.User', perm: str
) -> bool:
    """
    Returns True if user has specified permission for asset within region if
    not explicitly granted through Asset.assign_perm()
    """
    return perm in get_regional_user_permissions(asset, user)


def user_has_view_perms(user: 'auth.User', view: int) -> bool:
    """
    Returns True if user has any permissions permission to a specified view
    """
    return user.username in [
        v.username for v in get_regional_assignments() if v.view == view
    ]


def view_has_perm(view: int, perm: str) -> bool:
    """
    Returns True if a view has a specified permission associated with it
    """
    if view is not None:
        # flattened list of permissions
        perms_for_view = [
            perm
            for v in get_regional_views()
            for perm in v.permissions
            if v.id == view
        ]
        if perm in perms_for_view:
            return True
    return False


def get_region_for_view(view: int) -> List[str]:
    """
    Returns list of county codes for a specified view id
    """
    regions = [r.countries for r in get_regional_views() if r.id == view]
    return regions[0] if regions else []


def get_regional_views_for_user(
    user: 'auth.User', view: int
) -> List[RegionalView]:
    """
    Returns a list of all available regional views for a user
    """
    views_for_user = [
        v.view
        for v in get_regional_assignments()
        if v.username == user.username
    ]
    return [v for v in get_regional_views() if v.id in views_for_user]


def get_view_from_request(request: Request) -> int:
    """
    Returns an int value for the view specified in the query params of the
    request
    """
    view = request.GET.get('view')
    if view is not None:
        try:
            view = int(view)
        except ValueError:
            raise Exception('`view` must be an integer value')
    return view
