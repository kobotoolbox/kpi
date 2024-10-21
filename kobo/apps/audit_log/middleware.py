
from kobo.apps.audit_log.models import ProjectHistoryLog, AuditType
from kpi.utils.log import logging
from rest_framework import status

def create_project_history_log_middleware(get_response):
    def do_thing(request):
        response = get_response(request)
        if request.method in ['GET', 'HEAD']:
            return response
        log_type = getattr(request, 'log_type', None)
        if log_type == AuditType.PROJECT_HISTORY:
            ProjectHistoryLog.create_from_request(request)
        return response
    return do_thing
