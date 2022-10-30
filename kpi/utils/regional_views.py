# coding: utf-8
import json

import constance
from rest_framework.request import Request

def get_regional_views():
    return json.loads(constance.config.REGIONAL_VIEWS)

def get_regional_assignments():
    return json.loads(constance.config.REGIONAL_ASSIGNMENTS)

def get_regional_user_permissions(
    asset: 'models.Asset', user: 'auth.User'
) -> list:

    asset_countries = get_asset_countries(asset)

    # views that asset is in
    views_for_asset = [
        view
        for view in get_regional_views()
        if (set(asset_countries) & set(view['countries']))
        or ('*' == view['countries'])
    ]
    if not views_for_asset:
        return []

    # view ids that user is in
    view_ids_for_user = [
        v['view']
        for v in get_regional_assignments()
        if v['username'] == user.username
    ]
    if not view_ids_for_user:
        return []

    # views that both the user and asset are in
    views_for_user_and_asset = [
        v for v in views_for_asset if v['id'] in view_ids_for_user
    ]
    if not views_for_user_and_asset:
        return []

    # permissions for asset
    return [perm for v in views_for_user_and_asset for perm in v['permissions']]


def get_asset_countries(asset: 'models.Asset') -> list:
    countries = asset.settings.get('country')
    if countries is not None and isinstance(countries, list):
        return [c['value'] for c in countries]
    return [countries['value']] if countries else []


def user_has_regional_asset_perm(
    asset: 'models.Asset', user: 'auth.User', perm: str
) -> bool:
    return perm in get_regional_user_permissions(asset, user)


def get_region_for_view(view: int) -> list:
    regions = [r['countries'] for r in get_regional_views() if r['id'] == view]
    return regions[0] if regions else []


def user_has_view_perms(user: 'auth.User', view: int) -> bool:
    region_users = [
        v['username'] for v in get_regional_assignments() if v['view'] == view
    ]
    return user.username in region_users


def get_view_from_request(request: Request) -> int:
    view = request.GET.get('view')
    if view is not None:
        try:
            view = int(view)
        except ValueError:
            raise Exception('`view` must be an integer value')
    return view


def get_regional_views_for_user(user: 'auth.User', view: int) -> list:
    available_views = [
        v['view']
        for v in get_regional_assignments()
        if v['username'] == user.username
    ]
    return [v for v in get_regional_views() if v['id'] in available_views]


def view_has_perm(view, perm):
    if view is not None:
        perms_for_view = [
            perm
            for v in get_regional_views()
            for perm in v['permissions']
            if v['id'] == view
        ]
        if perm in perms_for_view:
            return True
    return False
