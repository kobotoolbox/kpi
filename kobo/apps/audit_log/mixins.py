from .models import AuditLog


class RequiresAccessLogMixin:
    """
    Create an audit log for authentications that do not log a user in
    """

    def create_access_log(self, request, user, auth_type):
        log = AuditLog.create_access_log_for_request(
            request, user, authentication_type=auth_type
        )
        log.save()
