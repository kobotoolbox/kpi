from rest_framework import status

from kobo.apps.audit_log.models import AuditType, ProjectHistoryLog


def create_project_history_log_middleware(get_response):
    def create_audit_logs(request):
        response = get_response(request)
        if request.method in ['GET', 'HEAD']:
            return response
        if response.status_code == status.HTTP_404_NOT_FOUND:
            return response
        log_type = getattr(request, 'log_type', None)
        url_name = request.resolver_match.url_name

        if (
            status.is_success(response.status_code) and
            log_type == AuditType.PROJECT_HISTORY
        ):
            ProjectHistoryLog.create_from_request(request)
        # special case: log bulk delete requests even if there is an
        # error. Things may have been deleted in mongo before the request timed out,
        # and we'd rather have false positives than missing records
        elif (
            log_type == AuditType.PROJECT_HISTORY
            and url_name == 'submission-bulk'
            and request.method == 'DELETE'
        ):
            ProjectHistoryLog.create_from_request(request)
        return response

    return create_audit_logs
