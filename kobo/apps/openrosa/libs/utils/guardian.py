from django.conf import settings
from guardian.shortcuts import (
    assign_perm as guardian_assign_perm,
    get_objects_for_user as guardian_get_objects_for_user,
    get_perms_for_model as guardian_get_perms_for_model,
    get_users_with_perms as guardian_get_users_with_perms,
    remove_perm as guardian_remove_perm,
)

from kpi.utils.database import use_db

# These utilities use `use_db` context manager to force to use KoboCAT database,
# but the most of the time, they return a queryset which is not evaluated.
# `use_db` is useful for evaluated queryset inside django-quardian utilities to
# ensure they use the correct database.
# ⚠️ For the returned not-yet-evaluated queryset, be sure the main model belongs
# to `openrosa` django app (the db router will force to use KoboCAT database) or
# use another context manager `with use_db` when the queryset is evaluated.


def assign_perm(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_assign_perm(*args, **kwargs)


def get_objects_for_user(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_get_objects_for_user(*args, **kwargs)


def get_perms_for_model(cls):
    # The use of the generator permits to evaluate the permission codenames
    # in the database context (and retrieve their real name in KoboCAT tables
    # and not KPI with equivalent PK)
    with use_db(settings.OPENROSA_DB_ALIAS):
        for perm in guardian_get_perms_for_model(cls).select_related(
            'content_type'
        ):
            yield perm


def get_users_with_perms(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_get_users_with_perms(*args, **kwargs)


def remove_perm(*args, **kwargs):
    with use_db(settings.OPENROSA_DB_ALIAS):
        return guardian_remove_perm(*args, **kwargs)
