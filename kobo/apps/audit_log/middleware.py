from rest_framework import status

from kobo.apps.audit_log.models import AuditType, ProjectHistoryLog


def create_project_history_log_middleware(get_response):
    def create_audit_logs(request):
        response = get_response(request)
        if request.method in ['GET', 'HEAD']:
            return response
        log_type = getattr(request, 'log_type', None)
        url_name = request.resolver_match.url_name

        if (
            status.is_success(response.status_code) and
            log_type == AuditType.PROJECT_HISTORY
        ):
            ProjectHistoryLog.create_from_request(request)
        # special case: log bulk delete requests even if the request times out.
        # Things may have been deleted before the request timed out, and we'd
        # rather have false positives than miss deletions
        elif (
            response.status_code == status.HTTP_408_REQUEST_TIMEOUT
            and log_type == AuditType.PROJECT_HISTORY
            and url_name == 'submission-bulk'
        ):
            ProjectHistoryLog.create_from_request(request)
        return response

    return create_audit_logs
