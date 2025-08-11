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
    from kobo.apps.openrosa.apps.logger.models.xform import XForm
    from kpi.utils.object_permission import (
        get_objects_for_user as kpi_get_objects_for_user,
    )

    # By default kpi.utils.object_permissions.get_objects_for_user works for Asset model
    qs_assets = kpi_get_objects_for_user(user, [perm])
    uids = list(qs_assets.values_list('uid', flat=True))
    xform_ids = list(
        XForm.objects.filter(kpi_asset_uid__in=uids).values_list('id', flat=True)
    )
    return xform_ids


@cache_for_request
def get_model_permission_codenames() -> list[str]:
    kc_perms = set(Permission.objects.using(settings.OPENROSA_DB_ALIAS).values_list(
        'codename', flat=True
    ))
    kpi_perms = set(Permission.objects.values_list('codename', flat=True))
    return list(kc_perms - kpi_perms)
