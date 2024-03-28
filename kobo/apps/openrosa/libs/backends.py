from django.conf import settings
from guardian.backends import (
    ObjectPermissionBackend as GuardianObjectPermissionBackend,
)

from kpi.utils.database import use_db
from .constants import OPENROSA_APP_LABELS


class ObjectPermissionBackend(GuardianObjectPermissionBackend):
    """
    Overloads django-guardian backend class to return immediately
    if `obj` belongs to KPI models.
    """

    def get_all_permissions(self, user_obj, obj=None):

        if obj and obj._meta.app_label not in OPENROSA_APP_LABELS:
            return set()

        with use_db(settings.OPENROSA_DB_ALIAS):
            return super().get_all_permissions(user_obj=user_obj, obj=obj)

    def has_perm(self, user_obj, perm, obj=None):

        if obj and obj._meta.app_label not in OPENROSA_APP_LABELS:
            return False

        with use_db(settings.OPENROSA_DB_ALIAS):
            return super().has_perm(user_obj=user_obj, perm=perm, obj=obj)
