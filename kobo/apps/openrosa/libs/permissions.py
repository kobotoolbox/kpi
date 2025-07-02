from django.apps import apps
from django.conf import settings
from django.contrib.auth.models import Permission
from django_request_cache import cache_for_request

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
    'change_xform': PERM_CHANGE_ASSET,  # "Can change XForm" in KC shell
    'view_xform': PERM_VIEW_ASSET,  # "Can view XForm" in KC shell
    'report_xform': PERM_ADD_SUBMISSIONS,  # "Can make submissions to the form" in KC shell  # noqa
    'delete_data_xform': PERM_DELETE_SUBMISSIONS,  # "Can delete submissions" in KC shell  # noqa
    'validate_xform': PERM_VALIDATE_SUBMISSIONS,  # "Can validate submissions" in KC shell  # noqa
    'delete_xform': PERM_DELETE_ASSET,  # "Can delete XForm" in KC shell
}

# Wrapper functions for KPI object permissions system


XFORM_MODELS_NAMES = [
    'xform',
    'datadictionary',
]

def assign_perm(perm, user, instance):
    if instance._meta.model_name in XFORM_MODELS_NAMES:
        instance = instance.asset  # XForms permissions are based on the asset's
        perm = KPI_PERMISSIONS_MAP[perm.replace('logger.', '')]
    instance.assign_perm(user, perm)


def get_users_with_perms(instance, attach_perms=False):
    return instance.get_users_with_perms(attach_perms)


def remove_perm(perm, user, instance):
    if instance._meta.model_name == 'xform':
        instance = instance.asset  # XForms permissions are based on the asset's
        perm = KPI_PERMISSIONS_MAP[perm.replace('logger.', '')]
    instance.remove_perm(user, perm)


def get_xform_ids_for_user(user):
    from kpi.utils.object_permission import (
        get_objects_for_user as kpi_get_objects_for_user,
    )

    XForm = apps.get_model('logger.xform')
    # By default kpi.utils.object_permissions.get_objects_for_user works for Asset model
    qs_assets = kpi_get_objects_for_user(user, [PERM_VIEW_ASSET])
    uids = [row[0] for row in qs_assets.values_list('uid')]
    xform_ids = [
        row[0] for row in XForm.objects.values_list('id').filter(kpi_asset_uid__in=uids)
    ]
    return xform_ids


def get_object_users_with_permissions(obj, exclude=None, serializable=False):
    """Returns users, roles and permissions for a object.
    When called with with `serializable=True`, return usernames (strings)
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
def get_model_permission_codenames():
    kc_perms = set(Permission.objects.using(settings.OPENROSA_DB_ALIAS).values_list(
        'codename', flat=True
    ))
    kpi_perms = set(Permission.objects.values_list('codename', flat=True))
    return list(kc_perms - kpi_perms)
