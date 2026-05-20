from pytest import fixture
from django.db import connection

from kobo.apps.user_reports.utils.migrations import (
    CREATE_INDEXES_SQL,
    CREATE_MV_SQL,
)
from kpi.utils.object_permission import get_anonymous_user


@fixture(scope='session', autouse=True)
def anonymous_user(django_db_setup, django_db_blocker):
    # Create the AnonymousUser record once for the entire test session.
    # Previously this ran before every test (function scope), causing a DB
    # hit per test even though the record never changes.
    with django_db_blocker.unblock():
        return get_anonymous_user()


@fixture(scope='session', autouse=True)
def user_reports_materialized_view(django_db_setup, django_db_blocker):
    # The user_reports MV is dropped by migration 0008_drop_mv_before_djstripe
    # and recreated in production by a long-running migration that doesn't run
    # during tests. Create it here so tests calling
    # `refresh_user_reports_materialized_view` don't fail.

    with django_db_blocker.unblock(), connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_matviews WHERE matviewname = 'user_reports_userreportsmv'"
        )
        if cursor.fetchone() is None:
            cursor.execute(CREATE_MV_SQL)
            cursor.execute(CREATE_INDEXES_SQL)
