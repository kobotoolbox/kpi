from .models import AccessLog


class RequiresAccessLogMixin:
    """
    Create an audit log for authentications that do not log a user in
    """

    def create_access_log(self, request, user, auth_type):
        AccessLog.create_from_request(request, user, authentication_type=auth_type)
