from django.db.models import Count
from django.db.models.functions import Coalesce
from rest_framework import mixins, viewsets
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer

from kpi.filters import SearchFilter
from kpi.permissions import IsAuthenticated
from .filters import AccessLogPermissionsFilter
from .models import AccessLog, AuditAction, AuditLog
from .permissions import SuperUserPermission
from .serializers import AccessLogSerializer, AuditLogSerializer


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
    >                    "object_id": 1,
    >                    "user": "http://kf.kobo.local/users/kobo_user/",
    >                    "action": "delete",
    >                    "log_type": "asset-management",
    >                    "method": "delete",
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


class AccessLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Access logs

    Lists all access logs for the requesting user, with submissions grouped by time and user.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/access-logs/all
    </pre>
    """

    model = AccessLog
    serializer_class = AccessLogSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = (AccessLogPermissionsFilter,)
    renderer_classes = (
        BrowsableAPIRenderer,
        JSONRenderer,
    )
    queryset = (
        AccessLog.objects.select_related('user')
        .values(
            'user__username',
            'submission_group',
            'object_id',
            'user_uid',
        )
        # if we have a submission group, use its metadata/date_created for all its submissions
        # so they will be grouped correctly
        # otherwise use the information from the log itself
        .annotate(
            metadata=Coalesce('submission_group__metadata', 'metadata'),
            date_created=Coalesce(
                'submission_group__date_created', 'date_created'
            ),
            count=Count('pk'),
        )
        .order_by('-date_created')
    )


class AllAccessLogViewSet(AccessLogViewSet):
    """
    Access logs

    Lists all access logs for all users, with submissions grouped by time and user. Only available to superusers.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/access-logs/all
    </pre>

    Results from this endpoint can be filtered by a Boolean query specified in the `q` parameter.
    Some useful fields for filtering:

    `user__username`

    `date_created`

    `user_uid`

    `metadata__auth_type`

    `metadata__ip_address`

    **Examples:**

    1. All access logs for user 'admin'<br>
        `api/v2/access-logs/all/?q=username:admin`

    2. All access logs after a specific date<br>
        `/api/v2/access-logs/all/?q=date_created__gte:2022-11-15`

    3. All access logs from token-authenticated requests<br>
        `/api/v2/access-logs/all/?q=metadata__auth_type:token`

    """

    permission_classes = (SuperUserPermission,)
    filter_backends = (SearchFilter,)
    search_default_field_lookups = [
        'username__icontains',
    ]
