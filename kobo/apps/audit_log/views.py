from rest_framework import mixins, viewsets
from rest_framework.renderers import BrowsableAPIRenderer, JSONRenderer

from kpi.filters import SearchFilter
from .models import AuditLog
from .permissions import SuperUserPermission
from .serializers import AuditLogSerializer


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
    >                    "method": "DELETE",
    >               }
    >           ]
    >       }

    Results from this endpoint can be filtered by a Boolean query specified in the `q` parameter.

    **Some examples:**

    1. All deleted submissions<br>
        `api/v2/audit-logs/?q=method:delete`

    2. All deleted submissions of a specific project `aTJ3vi2KRGYj2NytSzBPp7`<br>
        `api/v2/audit-logs/?q=method:delete AND metadata__asset_uid:aTJ3vi2KRGYj2NytSzBPp7`

    3. All submissions deleted by a specific user `my_username`<br>
        `api/v2/audit-logs/?q=method:delete AND user__username:my_username`

    4. All deleted submissions submitted after a specific date<br>
        `/api/v2/audit-logs/?q=method:delete AND date_created__gte:2022-11-15`

    5. All deleted submissions submitted after a specific date **and time**<br>
        `/api/v2/audit-logs/?q=method:delete AND date_created__gte:"2022-11-15 20:34"`

    *Notes: Do not forget to wrap search terms in double-quotes if they contain spaces (e.g. date and time "2022-11-15 20:34")*

    ### CURRENT ENDPOINT
    """

    model = AuditLog
    serializer_class = AuditLogSerializer
    permission_classes = (SuperUserPermission,)
    renderer_classes = (BrowsableAPIRenderer, JSONRenderer,)
    queryset = (
        AuditLog.objects.select_related('user').all().order_by('-date_created')
    )
    filter_backends = (SearchFilter,)

    search_default_field_lookups = [
        'app_label__icontains',
        'model_name__icontains',
        'metadata__icontains',
    ]
