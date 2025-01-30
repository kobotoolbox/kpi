from django.conf import settings
from django.contrib.auth.management import DEFAULT_DB_ALIAS

from kobo.apps.openrosa.libs.constants import OPENROSA_APP_LABELS
from kpi.utils.database import get_thread_local

from .constants import SHADOW_MODEL_APP_LABELS, SHARED_APP_LABELS
from .exceptions import ReadOnlyModelError


class DefaultDatabaseRouter:

    def db_for_read(self, model, **hints):
        """
        Reads go to KoboCAT database when `model` is a ShadowModel
        """
        if (
            model._meta.app_label in SHADOW_MODEL_APP_LABELS
            or model._meta.app_label in OPENROSA_APP_LABELS
        ):
            return settings.OPENROSA_DB_ALIAS

        return get_thread_local('DB_ALIAS', DEFAULT_DB_ALIAS)

    def db_for_write(self, model, **hints):
        """
        Writes go to KoboCAT database when `model` is a ShadowModel
        """

        if getattr(model, 'read_only', False):
            raise ReadOnlyModelError

        if (
            model._meta.app_label in SHADOW_MODEL_APP_LABELS
            or model._meta.app_label in OPENROSA_APP_LABELS
        ):
            return settings.OPENROSA_DB_ALIAS

        return get_thread_local('DB_ALIAS', DEFAULT_DB_ALIAS)

    def allow_relation(self, obj1, obj2, **hints):
        """
        Relations between objects are allowed
        """
        # Relationship between databases will raise an error, but it helps
        # to lure Django to construct SQL queries when using models which exist
        # in both databases (i.e. `auth_user`)
        return True

    def allow_migrate(self, db, app_label, model=None, **hints):
        """
        All default models end up in this pool.
        """
        if app_label in SHARED_APP_LABELS:
            return True

        if db == DEFAULT_DB_ALIAS and app_label in OPENROSA_APP_LABELS:
            return False

        if (
            app_label in SHADOW_MODEL_APP_LABELS or
            db != DEFAULT_DB_ALIAS
            and app_label not in OPENROSA_APP_LABELS
        ):
            return False

        return True


class SingleDatabaseRouter(DefaultDatabaseRouter):

    def db_for_read(self, model, **hints):
        """
        Reads always go to `default`
        """
        return DEFAULT_DB_ALIAS

    def db_for_write(self, model, **hints):
        """
        Writes always go to default
        """
        return DEFAULT_DB_ALIAS

    def allow_migrate(self, db, app_label, model=None, **hints):
        if app_label in SHADOW_MODEL_APP_LABELS:
            return False

        return True


class TestingDatabaseRouter(SingleDatabaseRouter):

    pass
