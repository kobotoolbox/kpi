import threading
from functools import wraps

from django.conf import settings
from django.db import connections, models

thread_local = threading.local()


class use_db:
    """
    source: https://adriennedomingus.medium.com/django-databases-and-decorators-14fa1f9a5c97
    """
    def __init__(self, database_name):
        self.database_name = database_name

    def __enter__(self):
        setattr(thread_local, 'DB_ALIAS', self.database_name)

    def __exit__(self, exc_type, exc_value, traceback):
        setattr(thread_local, 'DB_ALIAS', None)

    def __call__(self, test_func):
        @wraps(test_func)
        def inner(*args, **kwargs):
            return test_func(*args, **kwargs)
        return inner


def get_thread_local(attr, default=None):
    return getattr(thread_local, attr, None) or default


def update_autofield_sequence(
    model: models.Model, using: str = settings.OPENROSA_DB_ALIAS
):
    """
    Fixes the PostgreSQL sequence for the first (and only?) `AutoField` on
    `model`, à la `manage.py sqlsequencereset`
    """
    # Updating sequences on fresh environments fails because the only user
    # in the DB is django-guardian AnonymousUser and `max(pk)` returns -1.
    # Error:
    #   > setval: value -1 is out of bounds for sequence
    # Using abs() and testing if max(pk) equals -1, leaves the sequence alone.

    # Intermediate variable `single_quotes_args` is just here to lure linter about Q000
    single_quotes_args = "'{table}','{column}'"
    sql_template = (
        'SELECT setval('
        f'   pg_get_serial_sequence({single_quotes_args}), '
        '   abs(coalesce(max({column}), 1)), '
        '   max({column}) IS NOT null and max({column}) != -1'
        ') '
        'FROM {table};'
    )
    autofield = None
    for f in model._meta.get_fields():
        if isinstance(f, models.AutoField):
            autofield = f
            break
    if not autofield:
        return
    query = sql_template.format(table=model._meta.db_table, column=autofield.column)
    connection = connections[using]
    with connection.cursor() as cursor:
        cursor.execute(query)
