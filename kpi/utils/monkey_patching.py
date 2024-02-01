import django.contrib.auth.management
from django.contrib.auth.management import (
    create_permissions as django_create_permissions,
    DEFAULT_DB_ALIAS,
)

from django.conf import settings


def create_permissions(app_config, using=DEFAULT_DB_ALIAS, **kwargs):
    """
    Avoid to create permissions on the wrong database when post signal is emitted
    on migrations
    """
    if (
        app_config.label in settings.OPENROSA_APP_LABELS
        and using == DEFAULT_DB_ALIAS
    ):
        return

    return django_create_permissions(app_config=app_config, using=using, **kwargs)


django.contrib.auth.management.create_permissions = create_permissions
