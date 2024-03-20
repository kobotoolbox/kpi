from django.conf import settings
from guardian.shortcuts import (
    assign_perm as guardian_assign_perm,
    get_objects_for_user as guardian_get_objects_for_user,
    get_perms_for_model as guardian_get_perms_for_model,
    get_users_with_perms as guardian_get_users_with_perms,
    remove_perm as guardian_remove_perm,
)
from kpi.utils.database import use_db


def assign_perm(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_assign_perm(*args, **kwargs)


def get_objects_for_user(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_get_objects_for_user(*args, **kwargs)


def get_perms_for_model(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_get_perms_for_model(*args, **kwargs)


def get_users_with_perms(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_get_users_with_perms(*args, **kwargs)


def remove_perm(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_remove_perm(*args, **kwargs)
