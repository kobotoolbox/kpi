from contextlib import contextmanager
from unittest import mock

from django.contrib.auth.management import DEFAULT_DB_ALIAS


@contextmanager
def immediate_on_commit(using=None):
    """
    Context manager executing transaction.on_commit() hooks immediately as
    if the connection was in auto-commit mode. This is required when
    using a subclass of django.test.TestCase as all tests are wrapped in
    a transaction that never gets committed.

    Source: https://code.djangoproject.com/ticket/30457#comment:1
    """
    immediate_using = DEFAULT_DB_ALIAS if using is None else using

    def on_commit(func, using=None):
        using = DEFAULT_DB_ALIAS if using is None else using
        if using == immediate_using:
            func()

    with mock.patch('django.db.transaction.on_commit', side_effect=on_commit) as patch:
        yield patch
