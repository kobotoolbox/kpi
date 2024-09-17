from django.db.models.functions import Coalesce, Trunc, Concat, Cast
from django.db.models import When, Count, Case, F, Value, Min
from django.db import models
from rest_framework import mixins, viewsets
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer

from kpi.filters import SearchFilter
from kpi.permissions import IsAuthenticated
from .filters import AccessLogPermissionsFilter
from .models import AccessLog, AuditAction, AuditLog
from .permissions import SuperUserPermission
from .serializers import AuditLogSerializer, AccessLogSerializer


def get_submission_dict():
    return {'auth_type': 'submission-group'}

class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Audit logs

    Lists the actions performed (delete, update, create) by users.
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
    >           "count": 1,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                    "app_label": "foo",
    >                    "model_name": "bar",
    >                    "user": "http://kf.kobo.local/users/kobo_user/",
    >                    "action": "delete",
    >                    "log_type": "asset-management",
    >               }
    >           ]
    >       }

    Results from this endpoint can be filtered by a Boolean query specified in the `q` parameter.

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

    *Notes: Do not forget to wrap search terms in double-quotes if they contain spaces (e.g. date and time "2022-11-15 20:34")*

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

    <pre class="prettyprint">
    <b>GET</b> /api/v2/access-logs/all
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi-url]/access-logs/all

    > Response 200

    >       {
    >           "count": 10,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >                {
    >                   "app_label": "kobo_auth",
    >                    "model_name": "User",
    >                    "user": "http://localhost/api/v2/users/admin/",
    >                    "user_uid": "u12345",
    >                    "username": "admin",
    >                    "metadata": {
    >                        "source": "Firefox (Ubuntu)",
    >                        "auth_type": "Digest",
    >                        "ip_address": "172.18.0.6"
    >                   },
    >                    "date_created": "2024-08-19T16:48:58Z",
    >                    "log_type": "access"
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

    This endpoint can be filtered and paginated the same as the /audit-logs endpoint

    """

    queryset = (
        AccessLog.objects.select_related('user')
        .filter(action=AuditAction.AUTH)
        .values(
            'user__username',
            'object_id',
            'user_uid',
            'group_key'
        )
        .annotate(
            count=Count('pk'),
            metadata=Case(
                When(
                    metadata__auth_type='submission',
                    then=Value(get_submission_dict(), models.JSONField())
                ),
                default=F('metadata')
            ),
            date_created=Min('date_created')
        )
    )
    serializer_class = AccessLogSerializer



class AccessLogViewSet(AuditLogViewSet):
    """
    Access logs

    Lists all access logs for the authenticated user

    Submissions will be grouped together by hour

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
    >                   "app_label": "kobo_auth",
    >                    "model_name": "User",
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
    >      curl -X GET https://[kpi-url]/access-logs/?offset=100&limit=50

    will return entries 100-149

    """

    queryset = (
        AccessLog.objects.select_related('user')
        .filter(action=AuditAction.AUTH)
        .values(
            'user__username',
            'object_id',
            'user_uid',
            'group_key'
        )
        .annotate(
            count=Count('pk'),
            metadata=Case(
                When(
                    metadata__auth_type='submission',
                    then=Value(get_submission_dict(), models.JSONField())
                ),
                default=F('metadata')
            ),
            date_created=Min('date_created')
        )
    )
    permission_classes = (IsAuthenticated,)
    filter_backends = (AccessLogPermissionsFilter,)
    serializer_class = AccessLogSerializer
