from pytest import fixture

from kpi.utils.object_permission import get_anonymous_user


@fixture(scope='session', autouse=True)
def anonymous_user(django_db_setup, django_db_blocker):
    # Create the AnonymousUser record once for the entire test session.
    # Previously this ran before every test (function scope), causing a DB
    # hit per test even though the record never changes.
    with django_db_blocker.unblock():
        return get_anonymous_user()
