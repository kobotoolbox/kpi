from __future__ import unicode_literals, absolute_import
from .constants import SHADOW_MODEL_APP_LABEL


class DefaultDatabaseRouter(object):

    def db_for_read(self, model, **hints):
        """
        Reads primarily go to default.
        """
        if model._meta.app_label == SHADOW_MODEL_APP_LABEL:
            return "kobocat"
        return "default"

    def db_for_write(self, model, **hints):
        """
        Writes always go to primary.
        """
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        """
        Relations between objects are allowed
        """
        return True

    def allow_migrate(self, db, app_label, model=None, **hints):
        """
        All default models end up in this pool.
        """
        if app_label == SHADOW_MODEL_APP_LABEL:
            return False
        return True
