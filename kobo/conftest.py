from pytest import fixture

from kpi.utils.object_permission import get_anonymous_user


@fixture(autouse=True)
def anonymous_user():
    anon = get_anonymous_user()

    return anon
