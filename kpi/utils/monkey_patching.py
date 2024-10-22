import django.contrib.auth.management
import django.db.models.deletion
from django.conf import settings
from django.contrib.auth.management import DEFAULT_DB_ALIAS
from django.contrib.auth.management import (
    create_permissions as django_create_permissions,
)
from django.db import router

from kobo.apps.openrosa.libs.constants import OPENROSA_APP_LABELS
from kpi.constants import SHARED_APP_LABELS


def create_permissions(app_config, using=DEFAULT_DB_ALIAS, **kwargs):
    """
    Avoid creating permissions on the wrong database when post-signal is
    emitted on migrations
    """
    if (
        app_config.label in OPENROSA_APP_LABELS
        and using == DEFAULT_DB_ALIAS
        and not settings.TESTING
    ):
        return

    return django_create_permissions(app_config=app_config, using=using, **kwargs)


def get_candidate_relations_to_delete(opts):
    """
    Filter relations that are not from the same database

    The db connection is set at db router level. See `db_for_read()` and
    `db_for_write()` in `kpi/db_routers.py::DefaultDatabaseRouter` class.
    Unfortunately, it does not persist for candidates below.
    So, even if db connection is set to one database, Django could detect
    candidates to delete, based on `on_delete` attribute, from the other
    database - which obviously raises an error because the table does not exist.

    See https://github.com/django/django/blob/52116774549e27ac5d1ba9423e2fe61c5503a4a4/django/db/models/deletion.py#L86-L93  # noqa: E501
    """

    db_connection = router.db_for_write(opts.model)

    return (
        f
        for f in opts.get_fields(include_hidden=True)
        if f.auto_created and not f.concrete and (f.one_to_one or f.one_to_many)
        # new condition below from monkey-patching
        and (
            f.remote_field.model._meta.app_label in SHARED_APP_LABELS
            or (
                (
                    f.remote_field.model._meta.app_label in OPENROSA_APP_LABELS
                    and db_connection == settings.OPENROSA_DB_ALIAS
                )
                or (
                    f.remote_field.model._meta.app_label not in OPENROSA_APP_LABELS
                    and db_connection == DEFAULT_DB_ALIAS
                )
            )
        )
    )


django.contrib.auth.management.create_permissions = create_permissions
django.db.models.deletion.get_candidate_relations_to_delete = (
    get_candidate_relations_to_delete
)
