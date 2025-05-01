from django.db import transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework_extensions.mixins import NestedViewSetMixin

from kobo.apps.audit_log.docs.api.v2.access_logs.serializers.access_logs_serializers import *
from kpi.filters import SearchFilter
from kpi.models.import_export_task import (
    AccessLogExportTask,
    ImportExportTask,
    ProjectHistoryLogExportTask,
)
from kpi.permissions import IsAuthenticated
from kpi.tasks import export_task_in_background
from kpi.utils.docs.markdown import read_md
from kpi.utils.viewset_mixins import AssetNestedObjectViewsetMixin
from .filters import AccessLogPermissionsFilter
from .models import AccessLog, AuditLog, ProjectHistoryLog
from .permissions import SuperUserPermission, ViewProjectHistoryLogsPermission
from .serializers import (
    AccessLogSerializer,
    AuditLogSerializer,
    ProjectHistoryLogSerializer,
)


@extend_schema(
    tags=['audit-logs'],
)
class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Audit logs

    Lists actions performed by users.
    Only available for superusers.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/audit-logs/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/api/v2/audit-logs/

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


@extend_schema(
    tags=['Access-Logs'],
    description=read_md('audit_log', 'access_logs/list'),
)
class AllAccessLogViewSet(AuditLogViewSet):
    """
    ViewSet for managing superusers' access logs.

    Available actions:
    - list       → GET /api/v2/access-logs/exports/

    Documentation:
    - docs/api/v2/access_logs/list.md
    """
    queryset = AccessLog.objects.with_submissions_grouped().order_by('-date_created')
    serializer_class = AccessLogSerializer


@extend_schema(
    tags=['Access-Logs'],
    description=read_md('audit_log', 'access_logs/me/list'),
)
class AccessLogViewSet(AuditLogViewSet):
    """
    ViewSet for listing a user's access logs

    Available actions:
    - list       → GET /api/v2/access-logs/me/

    Documentation:
    - docs/api/v2/access_logs/me/list.md
    """

    queryset = AccessLog.objects.with_submissions_grouped().order_by('-date_created')
    permission_classes = (IsAuthenticated,)
    filter_backends = (AccessLogPermissionsFilter,)
    serializer_class = AccessLogSerializer


def generate_ph_view_set_logstring(description, path, example_path, all):
    return f"""
    Project history logs

    {description}

    <pre class="prettyprint">
    <b>GET</b> {path}
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]{example_path}

    > Response 200

    >       {{
    >           "count": 10,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >                {{
    >                    "user": "http://localhost/api/v2/users/admin/",
    >                    "user_uid": "u12345",
    >                    "username": "admin",
    >                    "action": "modify-user-permissions"
    >                    "metadata": {{
    >                        "source": "Firefox (Ubuntu)",
    >                        "ip_address": "172.18.0.6",
    >                        "asset_uid": "a678910",
    >                        "log_subtype": "permissions",
    >                        "permissions":
    >                            {{
    >                                "username": "user1",
    >                                "added": ["add_submissions", "view_submissions"],
    >                                "removed": ["change_asset"],
    >                            }}
    >                    }},
    >                    "date_created": "2024-08-19T16:48:58Z",
    >                }},
    >                {{
    >                    "user": "http://localhost/api/v2/users/admin/",
    >                    "user_uid": "u56789",
    >                    "username": "someuser",
    >                    "action": "update-settings",
    >                    "metadata": {{
    >                        "source": "Firefox (Ubuntu)",
    >                        "ip_address": "172.18.0.6",
    >                        "asset_uid": {"a111213" if all else "a678910"},
    >                        "log_subtype": "project",
    >                        "settings":
    >                            {{
    >                                "description":
    >                                    {{
    >                                        "old": "old_description",
    >                                        "new": "new_description",
    >                                    }}
    >                                "countries":
    >                                    {{
    >                                        "added": ["USA"],
    >                                        "removed": ["ALB"],
    >                                    }}
    >                            }}
    >                     }},
    >                    "date_created": "2024-08-19T16:48:58Z",
    >                }},
    >                ...
    >           ]
    >       }}

    Results from this endpoint can be filtered by a Boolean query
    specified in the `q` parameter.

    **Filterable fields for all project history logs:**

    1. date_created

    2. user_uid

    3. user__*

        a. user__username

        b. user__email

        c. user__is_superuser

    4. metadata__*

        b. metadata__source

        c. metadata__ip_address

        d. metadata__asset_uid

        e. metadata__log_subtype

        * available subtypes: "project", "permission"

    5. action

        available actions:

    >        add-media
    >        add-submission
    >        allow-anonymous-submissions
    >        archive
    >        clone-permissions
    >        connect-project
    >        delete-media
    >        delete-service
    >        delete-submission
    >        deploy
    >        disable-sharing
    >        disallow-anonymous-submissions
    >        disconnect-project
    >        enable-sharing
    >        export
    >        modify-imported-fields
    >        modify-qa-data
    >        modify-service
    >        modify-sharing
    >        modify-submission
    >        modify-user-permissions
    >        redeploy
    >        register-service
    >        replace-form
    >        share-data-publicly
    >        share-form-publicly
    >        transfer
    >        unarchive
    >        unshare-data-publicly
    >        unshare-form-publicly
    >        update-content
    >        update-name
    >        update-settings
    >        update-qa

    **Filterable fields by action:**

    * add-media

        a. metadata__asset-file__uid

        b. metadata__asset-file__filename

    * add-submission

        a. metadata__submission__submitted_by

        b. metadata__submission__root_uuid

    * archive

        a. metadata__latest_version_uid

    * clone-permissions

        a. metadata__cloned_from

    * connect-project

        a. metadata__paired-data__source_uid

        b. metadata__paired-data__source_name

    * delete-media

        a. metadata__asset-file__uid

        b. metadata__asset-file__filename

    * delete-service

        a. metadata__hook__uid

        b. metadata__hook__endpoint

        c. metadata__hook__active

    * delete-submission

        a. metadata__submission__submitted_by

        b. metadata__submission__root_uuid

    * deploy

        a. metadata__latest_version_uid

        b. metadata__latest_deployed_version_uid

    * disconnect-project

        a. metadata__paired-data__source_uid

        b. metadata__paired-data__source_name

    * modify-imported-fields

        a. metadata__paired-data__source_uid

        b. metadata__paired-data__source_name

    * modify-qa-data

        a. metadata__submission__submitted_by

        b. metadata__submission__root_uuid

    * modify-service

        a. metadata__hook__uid

        b. metadata__hook__endpoint

        c. metadata__hook__active

    * modify-submission

        a. metadata__submission__submitted_by

        b. metadata__submission__root_uuid

        b. metadata__submission__status (only present if changed)

    * modify-user-permissions

        a. metadata__permissions__username

    * redeploy

        a. metadata__latest_version_uid

        b. metadata__latest_deployed_version_uid

    * register-service

        a. metadata__hook__uid

        b. metadata__hook__endpoint

        c. metadata__hook__active

    * transfer

        a. metadata__username

    * unarchive

        a. metadata__latest_version_uid

    * update-name

        a. metadata__name__old

        b. metadata__name__new

    * update-settings

        a. metadata__settings__description__old

        b. metadata__settings__description__new

    This endpoint can be paginated with 'offset' and 'limit' parameters, eg
    >      curl -X GET https://[kpi-url]{example_path}?offset=100&limit=50

    """


class AllProjectHistoryLogViewSet(AuditLogViewSet):
    __doc__ = generate_ph_view_set_logstring(
        'List all project history logs for all projects. Only available to superusers.',
        '/api/v2/project-history-logs',
        '/api/v2/project-history-logs',
        True,
    )

    queryset = ProjectHistoryLog.objects.all().order_by('-date_created')
    serializer_class = ProjectHistoryLogSerializer
    filter_backends = (SearchFilter,)

    @action(detail=False, methods=['GET', 'POST'])
    def export(self, request, *args, **kwargs):
        in_progress = ProjectHistoryLogExportTask.objects.filter(
            user=request.user, asset_uid=None, status=ImportExportTask.PROCESSING
        ).count()
        if in_progress > 0:
            return Response(
                {
                    'error': (
                        'Export task for all project history logs already in progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        export_task = ProjectHistoryLogExportTask.objects.create(
            user=request.user,
            asset_uid=None,
            data={
                'type': 'project_history_logs_export',
            },
        )
        transaction.on_commit(
            lambda: export_task_in_background.delay(
                export_task_uid=export_task.uid,
                username=export_task.user.username,
                export_task_name='kpi.ProjectHistoryLogExportTask',
            )
        )

        return Response(
            {'status': export_task.status},
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema(
    tags=['history'],
)
class ProjectHistoryLogViewSet(
    AuditLogViewSet, AssetNestedObjectViewsetMixin, NestedViewSetMixin
):
    __doc__ = (
        generate_ph_view_set_logstring(
            'Lists all project history logs for a single project. Only available to'
            " those with 'manage_asset' permissions.",
            '/api/v2/assets/<code>{asset_uid}</code>/history/',
            '/api/v2/assets/aSAvYreNzVEkrWg5Gdcvg/history/',
            False,
        )
        + """
    ### Actions

    Retrieves distinct actions performed on the asset.
    <pre class="prettyprint">
    <b>GET</b> /api/v2/assets/<code>{asset_uid}</code>/history/actions
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/assets/axpCMM5zWS6kWpHv9Vg/history/actions

    > Response 200

    >       {
    >           "actions": [
    >               "update-name",
    >               "update-content",
    >               "deploy",
    >               ...
    >           ]
    >       }
    """
    )

    serializer_class = ProjectHistoryLogSerializer
    model = ProjectHistoryLog
    permission_classes = (ViewProjectHistoryLogsPermission,)
    lookup_field = 'uid'
    filter_backends = (SearchFilter,)

    def get_queryset(self):
        return self.model.objects.filter(metadata__asset_uid=self.asset_uid).order_by(
            '-date_created'
        )

    @action(detail=False, methods=['GET'])
    def actions(self, request, *args, **kwargs):
        actions = (
            self.model.objects.filter(metadata__asset_uid=self.asset_uid)
            .values_list('action')
            .distinct()
        )
        flattened = [action[0] for action in actions]
        return Response({'actions': flattened})

    @action(detail=False, methods=['POST'])
    def export(self, request, *args, **kwargs):
        in_progress = ProjectHistoryLogExportTask.objects.filter(
            user=request.user,
            asset_uid=self.asset_uid,
            status=ImportExportTask.PROCESSING,
        ).count()
        if in_progress > 0:
            return Response(
                {
                    'error': (
                        'Export task for project history logs for this asset already in'
                        ' progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        export_task = ProjectHistoryLogExportTask.objects.create(
            user=request.user,
            asset_uid=self.asset_uid,
            data={
                'type': 'project_history_logs_export',
            },
        )

        transaction.on_commit(
            lambda: export_task_in_background.delay(
                export_task_uid=export_task.uid,
                username=export_task.user.username,
                export_task_name='kpi.ProjectHistoryLogExportTask',
            )
        )
        return Response(
            {'status': export_task.status},
            status=status.HTTP_202_ACCEPTED,
        )


class BaseAccessLogsExportViewSet(viewsets.GenericViewSet):
    permission_classes = (IsAuthenticated,)
    lookup_field = 'uid'
    pagination_class = []

    def create_task(self, request, get_all_logs):

        export_task = AccessLogExportTask.objects.create(
            user=request.user,
            get_all_logs=get_all_logs,
            data={
                'type': 'access_logs_export',
            },
        )
        transaction.on_commit(
            lambda: export_task_in_background.delay(
                export_task_uid=export_task.uid,
                username=export_task.user.username,
                export_task_name='kpi.AccessLogExportTask',
            )
        )

        return Response(
            {'status': export_task.status},
            status=status.HTTP_202_ACCEPTED,
        )

    def list_tasks(self, user=None):
        tasks = AccessLogExportTask.objects.all()
        if user is not None:
            tasks = tasks.filter(user=user)
        tasks = tasks.order_by('-date_created')

        tasks_data = [
            {'uid': task.uid, 'status': task.status, 'date_created': task.date_created}
            for task in tasks
        ]

        return Response(tasks_data, status=status.HTTP_200_OK)


@extend_schema(
    tags=['Access-Logs'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('audit_log', 'access_logs/me/exports/list'),
        request=None,
        responses={200: OpenApiResponse(response=AccessLogListExportSerializer)},
    ),
    create=extend_schema(
        description=read_md('audit_log', 'access_logs/me/exports/create'),
        request=None,
        responses={202: OpenApiResponse(response=AccessLogMeCreateInlineSerializer)},
    ),
)
class AccessLogsExportViewSet(BaseAccessLogsExportViewSet):
    """
    ViewSet for managing the current user's access logs export

    Available actions:
    - list       → GET /api/v2/access-logs/me/export/
    - create       → POST /api/v2/access-logs/me/export/

    Documentation:
    - docs/api/v2/access_logs/me/exports/list.md
    - docs/api/v2/access_logs/me/exports/create.md
    """


    def create(self, request, *args, **kwargs):
        if AccessLogExportTask.objects.filter(
            user=request.user,
            status=AccessLogExportTask.PROCESSING,
            get_all_logs=False,
        ).exists():
            return Response(
                {
                    'error': (
                        'Export task for user access logs already in progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return self.create_task(request, get_all_logs=False)

    def list(self, request, *args, **kwargs):
        return self.list_tasks(request.user)


@extend_schema(
    tags=['Access-Logs'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('audit_log', 'access_logs/exports/list'),
        request=None,
        responses={200: OpenApiResponse(response=AccessLogListExportSerializer)},
    ),
    create=extend_schema(
        description=read_md('audit_log', 'access_logs/exports/create'),
        request=None,
        responses={202: OpenApiResponse(response=AccessLogMeCreateInlineSerializer)},
    ),
)
class AllAccessLogsExportViewSet(BaseAccessLogsExportViewSet):
    """
    ViewSet for managing every user's access logs export


    Available actions:
    - list       → GET /api/v2/access-logs/export/
    - create       → POST /api/v2/access-logs/export/

    Documentation:
    - docs/api/v2/access_logs/me/exports/list.md
    - docs/api/v2/access_logs/me/exports/create.md
    """

    permission_classes = (SuperUserPermission,)
    # serializer_class = AccessLogListExportSerializer

    def create(self, request, *args, **kwargs):
        # Check if the superuser has a task running for all
        if AccessLogExportTask.objects.filter(
            user=request.user,
            status=AccessLogExportTask.PROCESSING,
            get_all_logs=True,
        ).exists():
            return Response(
                {
                    'error': (
                        'Export task for all access logs already in progress.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return self.create_task(request, get_all_logs=True)

    def list(self, request, *args, **kwargs):
        return self.list_tasks()
