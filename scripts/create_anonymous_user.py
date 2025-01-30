from kpi.utils.object_permission import get_anonymous_user


def run():
    """
    Simple call to `get_anonymous_user()` to create the AnonymousUser if
    it doesn't exist.
    """
    get_anonymous_user()
