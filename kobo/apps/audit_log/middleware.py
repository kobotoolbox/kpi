from rest_framework import status

from kobo.apps.audit_log.models import AuditType, ProjectHistoryLog


def create_project_history_log_middleware(get_response):
    def create_audit_logs(request):
        # hello!
        response = get_response(request)
        if request.method in ['GET', 'HEAD']:
            return response
        log_type = getattr(request, 'log_type', None)
        if (
            status.is_success(response.status_code) and
            log_type == AuditType.PROJECT_HISTORY
        ):
            ProjectHistoryLog.create_from_request(request)
        return response

    return create_audit_logs
