from django.db import connection
from pytest import fixture

from kpi.utils.object_permission import get_anonymous_user


@fixture(autouse=True)
def anonymous_user():
    # Skip if there is no database enabled in the current test:
    if connection.connection is None:
        return

    anon = get_anonymous_user()

    return anon
