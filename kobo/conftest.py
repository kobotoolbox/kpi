from kpi.utils.object_permission import get_anonymous_user
from pytest import fixture


@fixture(autouse=True)
def anonymous_user():
    anon = get_anonymous_user()

    return anon
