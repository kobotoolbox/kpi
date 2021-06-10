# coding: utf-8
from .constants import SHADOW_MODEL_APP_LABELS
from .exceptions import ReadOnlyModelError


class DefaultDatabaseRouter:

    def db_for_read(self, model, **hints):
        """
        Reads go to KoBoCAT database when `model` is a ShadowModel
        """
        if model._meta.app_label in SHADOW_MODEL_APP_LABELS:
            return 'kobocat'
        return 'default'

    def db_for_write(self, model, **hints):
        """
        Writes go to KoBoCAT database when `model` is a ShadowModel
        """

        if getattr(model, 'read_only', False):
            raise ReadOnlyModelError

        if model._meta.app_label in SHADOW_MODEL_APP_LABELS:
            return 'kobocat'

        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """
        Relations between objects are allowed
        """
        return True

    def allow_migrate(self, db, app_label, model=None, **hints):
        """
        All default models end up in this pool.
        """
        if app_label in SHADOW_MODEL_APP_LABELS:
            return False
        return True


class SingleDatabaseRouter(DefaultDatabaseRouter):

    def db_for_read(self, model, **hints):
        """
        Reads always go to `default`
        """
        return 'default'

    def db_for_write(self, model, **hints):
        """
        Writes always go to default
        """
        return 'default'


class TestingDatabaseRouter(SingleDatabaseRouter):

    pass
