from rest_framework import exceptions, mixins, status, viewsets
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer
from rest_framework.response import Response

from kpi.filters import SearchFilter
from kpi.models.import_export_task import AccessLogExportTask
from kpi.permissions import IsAuthenticated
from kpi.tasks import export_task_in_background
from .filters import AccessLogPermissionsFilter
from .models import AccessLog, AuditLog
from .permissions import SuperUserPermission
from .serializers import AccessLogSerializer, AuditLogSerializer


class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Audit logs

    Lists actions performed by users.
    Only available for superusers.

    <span class='label label-warning'>For now, only `DELETE`s are logged</span>

    <pre class="prettyprint">
    <b>GET</b> /api/v2/audit-logs/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/audit-logs/

    > Response 200

    >       {
    >           "count": 2,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                    "app_label": "foo",
    >                    "model_name": "bar",
    >                    "user": "http://kf.kobo.local/api/v2/users/kobo_user/",
    >                    "user_uid": "u12345",
    >                    "action": "delete",
    >                    "date_created": "2024-10-01T00:01:00Z",
    >                    "log_type": "asset-management",
    >               },
    >               {
    >                    "app_label": "kobo_auth",
    >                    "model_name": "user",
    >                    "user": "http://kf.kobo.local/api/v2/users/another_user/",
    >                    "user_uid": "u12345",
    >                    "username": "another_user",
    >                    "action": "auth",
    >                    "metadata": {
    >                        "source": "Firefox (Ubuntu)",
    >                        "auth_type": "Digest",
    >                        "ip_address": "1.2.3.4"
    >                   },
    >                    "date_created": "2024-10-01T00:00:00Z",
    >                    "log_type": "access"
    >                },
    >           ]
    >       }

    Results from this endpoint can be filtered by a Boolean query specified in the
    `q` parameter.

    **Filterable fields:**

    1. app_label

    2. model_name

    3. action

        a. Available actions:

            i. create
            ii. delete
            iii. in-trash
            iv. put-back
            v. remove
            vi. update
            vii. auth

    4. log_type

        a. Available log types:

            i. access
            ii. project-history
            iii. data-editing
            iv. submission-management
            v. user-management
            vi. asset-management

    5. date_created

    6. user_uid

    7. user__*

        a. user__username

        b. user__email

        c. user__is_superuser

    8. metadata__*

        a. metadata__asset_uid

        b. metadata__auth_type

        c. some logs may have additional filterable fields in the metadata

    **Some examples:**

    1. All deleted submissions<br>
        `api/v2/audit-logs/?q=action:delete`

    2. All deleted submissions of a specific project `aTJ3vi2KRGYj2NytSzBPp7`<br>
        `api/v2/audit-logs/?q=action:delete AND metadata__asset_uid:aTJ3vi2KRGYj2NytSzBPp7`

    3. All submissions deleted by a specific user `my_username`<br>
        `api/v2/audit-logs/?q=action:delete AND user__username:my_username`

    4. All deleted submissions submitted after a specific date<br>
        `/api/v2/audit-logs/?q=action:delete AND date_created__gte:2022-11-15`

    5. All deleted submissions submitted after a specific date **and time**<br>
        `/api/v2/audit-logs/?q=action:delete AND date_created__gte:"2022-11-15 20:34"`

    6. All authentications from superusers<br>
        `api/v2/audit-logs/?q=action:auth AND user__is_superuser:True

    *Notes: Do not forget to wrap search terms in double-quotes if they contain spaces
    (e.g. date and time "2022-11-15 20:34")*

    ### CURRENT ENDPOINT
    """

    model = AuditLog
    serializer_class = AuditLogSerializer
    permission_classes = (SuperUserPermission,)
    renderer_classes = (
        BrowsableAPIRenderer,
        JSONRenderer,
    )
    queryset = (
        AuditLog.objects.select_related('user').all().order_by('-date_created')
    )
    filter_backends = (SearchFilter,)

    search_default_field_lookups = [
        'app_label__icontains',
        'model_name__icontains',
        'metadata__icontains',
    ]


class AllAccessLogViewSet(AuditLogViewSet):
    """
    Access logs

    Lists all access logs for all users. Only available to superusers.

    Submissions will be grouped together by user by hour

    <pre class="prettyprint">
    <b>GET</b> /api/v2/access-logs/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/access-logs/

    > Response 200

    >       {
    >           "count": 10,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >                {
    >                    "user": "http://localhost/api/v2/users/admin/",
    >                    "user_uid": "u12345",
    >                    "username": "admin",
    >                    "metadata": {
    >                        "source": "Firefox (Ubuntu)",
    >                        "auth_type": "digest",
    >                        "ip_address": "172.18.0.6"
    >                   },
    >                    "date_created": "2024-08-19T16:48:58Z",
    >                },
    >                {
    >                    "user": "http://localhost/api/v2/users/someuser/",
    >                    "user_uid": "u5678",
    >                    "username": "someuser",
    >                    "metadata": {
    >                        "auth_type": "submission-group",
    >                    },
    >                    "date_created": "2024-08-19T16:00:00Z"
    >                },
    >                ...
    >           ]
    >       }

    Results from this endpoint can be filtered by a Boolean query
    specified in the `q` parameter.

    **Filterable fields:**

    1. date_created

    2. user_uid

    3. user__*

        a. user__username

        b. user__email

        c. user__is_superuser

    4. metadata__*

        a. metadata__auth_type

            available auth types:

            i. django-loginas

            ii. token

            iii. digest

            iv. basic

            v. submission-group

            vi. kpi.backends.ModelBackend

            vii. authorized-application

            viii. oauth2

            ix. unknown

        b. metadata__source

        c. metadata__ip_address

        d. metadata__initial_user_uid

        e. metadata__initial_user_username

        f. metadata__authorized_app_name

    This endpoint can be paginated with 'offset' and 'limit' parameters, eg
    >      curl -X GET https://[kpi-url]/access-logs/?offset=100&limit=50
    """

    queryset = AccessLog.objects.with_submissions_grouped().order_by('-date_created')
    serializer_class = AccessLogSerializer


class AccessLogViewSet(AuditLogViewSet):
    """
    Access logs

    Lists all access logs for the authenticated user

    Submissions will be grouped together by hour

    <pre class="prettyprint">
    <b>GET</b> /api/v2/access-logs/me/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/access-logs/me/

    > Response 200

    >       {
    >           "count": 10,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >                {
    >                    "user": "http://localhost/api/v2/users/admin/",
    >                    "user_uid": "u12345",
    >                    "username": "admin",
    >                    "metadata": {
    >                        "source": "Firefox (Ubuntu)",
    >                        "auth_type": "Digest",
    >                        "ip_address": "172.18.0.6"
    >                    },
    >                    "date_created": "2024-08-19T16:48:58Z"
    >                },
    >                {
    >                    "user": "http://localhost/api/v2/users/admin/",
    >                    "user_uid": "u12345",
    >                    "username": "admin",
    >                    "metadata": {
    >                        "auth_type": "submission-group",
    >                    },
    >                    "date_created": "2024-08-19T16:00:00Z"
    >                },
    >                ...
    >           ]
    >       }

    This endpoint can be paginated with 'offset' and 'limit' parameters, eg
    >      curl -X GET https://[kpi-url]/access-logs/me/?offset=100&limit=50

    will return entries 100-149

    """

    queryset = AccessLog.objects.with_submissions_grouped().order_by('-date_created')
    permission_classes = (IsAuthenticated,)
    filter_backends = (AccessLogPermissionsFilter,)
    serializer_class = AccessLogSerializer


class AccessLogsExportViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticated,)
    lookup_field = 'uid'

    def create(self, request, uid=None, type=None, *args, **kwargs):
        if not request.user.is_superuser and 'access-logs/export' in request.path:
            raise exceptions.PermissionDenied(
                'Only superusers can export all access logs.'
            )

        get_all_logs = 'access-logs/export' in request.path

        # Superuser handling: one job for all logs and another for their own logs
        if request.user.is_superuser:
            # Check if the superuser has a task running for all or just their own logs
            if AccessLogExportTask.objects.filter(
                user=request.user,
                status=AccessLogExportTask.PROCESSING,
                get_all_logs=get_all_logs,
            ).exists():
                return Response(
                    {'error': 'You already have a running export task for this type.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # Non-superusers can only run one task for their own logs at a time
            if AccessLogExportTask.objects.filter(
                user=request.user,
                status=AccessLogExportTask.PROCESSING,
                get_all_logs=False,
            ).exists():
                return Response(
                    {
                        'error': (
                            'You already have a running export task for your own logs.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        export_task = AccessLogExportTask.objects.create(
            user=request.user,
            get_all_logs=get_all_logs,
            data={
                'type': 'access_logs_export',
            },
        )

        export_task_in_background.delay(
            export_task_uid=export_task.uid,
            username=export_task.user.username,
            export_task_name='kpi.AccessLogExportTask',
        )
        return Response(
            {f'status: {export_task.status}'},
            status=status.HTTP_202_ACCEPTED,
        )

    def list(self, request, *args, **kwargs):
        if not request.user.is_superuser and 'access-logs/export' in request.path:
            raise exceptions.PermissionDenied(
                'Only superusers can export all access logs.'
            )

        task = (
            AccessLogExportTask.objects.filter(user=request.user)
            .order_by('-date_created')
            .first()
        )

        if task:
            return Response(
                {'uid': task.uid, 'status': task.status}, status=status.HTTP_200_OK
            )
        else:
            return Response(
                {'error': 'No export task found for this user.'},
                status=status.HTTP_404_NOT_FOUND,
            )
