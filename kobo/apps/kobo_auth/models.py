from django.contrib.auth.models import Permission
from django.contrib.auth.models import AbstractUser


from kobo.apps.openrosa.libs.constants import (
    OPENROSA_APP_LABELS,
    OPENROSA_DB_ALIAS,
)
from kobo.apps.openrosa.libs.permissions import get_model_permission_codenames
from kpi.utils.database import use_db


class User(AbstractUser):

    class Meta:
        db_table = 'auth_user'
        swappable = 'AUTH_USER_MODEL'

    def has_perm(self, perm, obj=None):
        # if object is from Kobocat, check permission in Kobocat DB
        if obj:
            if obj._meta.app_label in OPENROSA_APP_LABELS:
                with use_db(OPENROSA_DB_ALIAS):
                    return super().has_perm(perm, obj)

        # if perm is from Kobocat, check permission in Kobocat DB
        if perm in get_model_permission_codenames():
            with use_db(OPENROSA_DB_ALIAS):
                return super().has_perm(perm, obj)

        # Otherwise, check in KPI DB
        return super().has_perm(perm, obj)
