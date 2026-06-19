from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from kpi.utils.drf_exceptions import custom_exception_handler
from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.kobo_scim.constants import SCIM_SCHEMA_ERROR


class ScimException(APIException):
    """
    Custom exception for SCIM-specific errors.
    """

    def __init__(
        self,
        detail,
        status_code=status.HTTP_400_BAD_REQUEST,
        error_code=None,
        reason=None,
    ):
        super().__init__(detail)
        self.status_code = status_code
        self.error_code = error_code
        self.reason = reason


def scim_exception_handler(exc, context):
    """
    Automated exception handler for SCIM API endpoints.
    Formats DRF APIExceptions, IntegrityError, and ValueError into
    strict SCIM Error Schema and optionally records a provisioning AuditLog.
    """
    # Call the global Kobo exception handler first
    response = custom_exception_handler(exc, context)

    status_code = None
    detail = None
    error_code = None
    reason = str(exc)

    if isinstance(exc, ScimException):
        status_code = exc.status_code
        detail = str(exc.detail)
        error_code = exc.error_code
        reason = exc.reason
    elif isinstance(exc, IntegrityError):
        status_code = status.HTTP_409_CONFLICT
        detail = 'One or more attributes in the resource already exists.'
        error_code = 'integrity_error'
    elif isinstance(exc, ValueError):
        status_code = status.HTTP_400_BAD_REQUEST
        detail = str(exc)
        error_code = 'value_error'

    if status_code is not None:
        view = context.get('view')
        request = context.get('request')

        # Generate an audit log if the view supports provisioning logs
        if view and hasattr(view, '_create_provisioning_audit_log'):
            data = getattr(request, 'data', {}) if request else {}
            username = data.get('userName', '')

            emails = data.get('emails', [])
            email = ''
            if emails and isinstance(emails, list):
                for e in emails:
                    if e.get('primary'):
                        email = e.get('value', '')
                        break
                if not email and len(emails) > 0:
                    email = emails[0].get('value', '')

            # If doing an update, fallback to existing user's attributes
            if hasattr(view, 'get_object') and getattr(view, 'kwargs', {}).get(
                getattr(view, 'lookup_field', 'pk')
            ):
                try:
                    user = view.get_object()
                    username = username or getattr(user, 'username', '')
                    email = email or getattr(user, 'email', '')
                except Exception:
                    pass

            view._create_provisioning_audit_log(
                action=AuditAction.PROVISIONING_ERROR,
                email=email,
                username=username,
                status_code=status_code,
                error=error_code,
                reason=reason,
            )

        # Build SCIM response
        return Response(
            {
                'schemas': [SCIM_SCHEMA_ERROR],
                'detail': detail,
                'status': str(status_code),
            },
            status=status_code,
        )

    # If it was an APIException handled by DRF, convert its payload to SCIM format
    if response is not None:
        if isinstance(response.data, dict) and 'detail' in response.data:
            detail = response.data['detail']
        else:
            detail = str(response.data)

        response.data = {
            'schemas': [SCIM_SCHEMA_ERROR],
            'detail': detail,
            'status': str(response.status_code),
        }

    return response
