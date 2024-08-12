from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.auth.models import AbstractUser


from kobo.apps.openrosa.libs.constants import (
    OPENROSA_APP_LABELS,
)
from kobo.apps.openrosa.libs.permissions import get_model_permission_codenames
from kpi.utils.database import use_db


class User(AbstractUser):

    class Meta:
        db_table = 'auth_user'
        swappable = 'AUTH_USER_MODEL'

    def has_perm(self, perm, obj=None):
        # If it is a KoboCAT permissions, check permission in KoboCAT DB first
        # 3 options:
        # - `obj` is not None and its app_label belongs to KoboCAT
        # - `perm` format is <app_label>.<perm>, we check the app label
        # - `perm` belongs to KoboCAT permission codenames
        if obj:
            if obj._meta.app_label in OPENROSA_APP_LABELS:
                with use_db(settings.OPENROSA_DB_ALIAS):
                    return super().has_perm(perm, obj)

        if '.' in perm:
            app_label, _ = perm.split('.', 1)
            if app_label in OPENROSA_APP_LABELS:
                with use_db(settings.OPENROSA_DB_ALIAS):
                    return super().has_perm(perm, obj)

        if perm in get_model_permission_codenames():
            with use_db(settings.OPENROSA_DB_ALIAS):
                return super().has_perm(perm, obj)

        # Otherwise, check in KPI DB
        return super().has_perm(perm, obj)
