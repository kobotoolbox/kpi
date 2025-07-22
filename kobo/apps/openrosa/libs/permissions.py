from django.conf import settings
from django.contrib.auth.models import Permission
from django_request_cache import cache_for_request

from kobo.apps.openrosa.libs.constants import (
    CAN_ADD_SUBMISSIONS,
    CAN_CHANGE_XFORM,
    CAN_DELETE_DATA_XFORM,
    CAN_DELETE_XFORM,
    CAN_VALIDATE_XFORM,
    CAN_VIEW_XFORM,
)
from kobo.apps.openrosa.libs.utils.guardian import (
    get_users_with_perms as guardian_get_users_with_perms,
)
from kpi.constants import (
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_DELETE_ASSET,
    PERM_DELETE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_ASSET,
)

KPI_PERMISSIONS_MAP = {  # keys are KPI's codenames, values are KC's
    CAN_CHANGE_XFORM: PERM_CHANGE_ASSET,  # "Can change XForm" in KC shell
    CAN_VIEW_XFORM: PERM_VIEW_ASSET,  # "Can view XForm" in KC shell
    CAN_ADD_SUBMISSIONS: PERM_ADD_SUBMISSIONS,  # "Can make submissions to the form" in KC shell  # noqa
    CAN_DELETE_DATA_XFORM: PERM_DELETE_SUBMISSIONS,  # "Can delete submissions" in KC shell  # noqa
    CAN_VALIDATE_XFORM: PERM_VALIDATE_SUBMISSIONS,  # "Can validate submissions" in KC shell  # noqa
    CAN_DELETE_XFORM: PERM_DELETE_ASSET,  # "Can delete XForm" in KC shell
}


XFORM_MODELS_NAMES = [
    'xform',
    'datadictionary',
]


# Wrapper functions for KPI object permissions system


def assign_perm(perm: str, user: 'settings.AUTH_USER_MODEL', obj) -> bool:
    if hasattr(obj, 'asset'):
        obj = obj.asset  # XForms permissions are based on the asset's
        only_perm = perm.split('.')[-1]
        perm = KPI_PERMISSIONS_MAP[only_perm]
    obj.assign_perm(user, perm)


@cache_for_request
def get_users_with_perms(
    obj, attach_perms: bool = False
) -> list['settings.AUTH_USER_MODEL']:
    return obj.get_users_with_perms(attach_perms)


def remove_perm(perm: str, user: 'settings.AUTH_USER_MODEL', obj):
    if hasattr(obj, 'asset'):
        obj = obj.asset  # XForms permissions are based on the asset's
        only_perm = perm.split('.')[-1]
        perm = KPI_PERMISSIONS_MAP[only_perm]
    obj.remove_perm(user, perm)


@cache_for_request
def get_xform_ids_for_user(
    user: 'settings.AUTH_USER_MODEL', perm: str = CAN_VIEW_XFORM
) -> list[int]:
    from kobo.apps.openrosa.apps.logger.models.xform import XForm
    from kpi.utils.object_permission import (
        get_objects_for_user as kpi_get_objects_for_user,
    )

    only_perm = perm.split('.')[-1]
    perm = KPI_PERMISSIONS_MAP[only_perm]
    # By default kpi.utils.object_permissions.get_objects_for_user works for Asset model
    qs_assets = kpi_get_objects_for_user(user, [perm])
    uids = list(qs_assets.values_list('uid', flat=True))
    xform_ids = list(
        XForm.objects.filter(kpi_asset_uid__in=uids).values_list('id', flat=True)
    )
    return xform_ids


def get_object_users_with_permissions(obj, serializable: bool = False) -> list[dict]:
    """Returns users, roles and permissions for an object.
    When called with `serializable=True`, return usernames (strings)
    instead of User objects, which cannot be serialized by REST Framework.
    """
    result = []

    if obj:
        users_with_perms = guardian_get_users_with_perms(
            obj, attach_perms=True, with_group_users=False
        ).items()

        result = [{
            'user': user if not serializable else user.username,
            'permissions': permissions} for user, permissions in
            users_with_perms
        ]

    return result


@cache_for_request
def get_model_permission_codenames() -> list[str]:
    kc_perms = set(Permission.objects.using(settings.OPENROSA_DB_ALIAS).values_list(
        'codename', flat=True
    ))
    kpi_perms = set(Permission.objects.values_list('codename', flat=True))
    return list(kc_perms - kpi_perms)
