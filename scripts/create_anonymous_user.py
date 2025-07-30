from hub.models import ExtraUserDetail
from kpi.utils.object_permission import get_anonymous_user


def run():
    """
    Simple call to `get_anonymous_user()` to create the AnonymousUser if
    it doesn't exist.
    """
    anon = get_anonymous_user()
    # Ensure the anonymous user has extra details
    ExtraUserDetail.objects.get_or_create(user_id=anon.pk)

