from django.conf import settings
from django.contrib.auth.models import Permission
from django_request_cache import cache_for_request

from kpi.constants import PERM_VIEW_ASSET

XFORM_MODELS_NAMES = [
    'xform',
    'datadictionary',
]


# Wrapper functions for KPI object permissions system


def assign_perm(perm: str, user: 'settings.AUTH_USER_MODEL', obj) -> bool:
    obj.assign_perm(user, perm)


@cache_for_request
def get_users_with_perms(
    obj, attach_perms: bool = False
) -> list['settings.AUTH_USER_MODEL']:
    return obj.get_users_with_perms(attach_perms)


def remove_perm(perm: str, user: 'settings.AUTH_USER_MODEL', obj):
    obj.remove_perm(user, perm)


@cache_for_request
def get_xform_ids_for_user(
    user: 'settings.AUTH_USER_MODEL', perm: str = PERM_VIEW_ASSET
) -> list[int]:
    from kpi.utils.object_permission import (
        get_objects_for_user as kpi_get_objects_for_user,
    )

    # XForms used to rely on their own permission system, with Django Guardian,
    # but now delegate to KPI's ObjectPermission via the related `asset`.
    # ⚠️ Projects created in legacy KoboCAT and not yet synced to KPI will be excluded.
    qs_assets = kpi_get_objects_for_user(user, [perm])
    xform_ids = [
        xid
        for xid in qs_assets.filter(date_deployed__isnull=False)
        .values_list('_deployment_data__backend_response__formid', flat=True)
        .order_by()
        if xid is not None
    ]
    return xform_ids


@cache_for_request
def get_model_permission_codenames() -> list[str]:
    kc_perms = set(Permission.objects.using(settings.OPENROSA_DB_ALIAS).values_list(
        'codename', flat=True
    ))
    kpi_perms = set(Permission.objects.values_list('codename', flat=True))
    return list(kc_perms - kpi_perms)
