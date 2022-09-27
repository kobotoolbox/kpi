from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAdminUser
from rest_framework.renderers import JSONRenderer

from kpi.filters import SearchFilter
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Audit logs

    Lists the actions performed (delete, update, create) by users.
    Only available for superusers.

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
    For example: api/v2/audit-logs/?q=method:delete



    ### CURRENT ENDPOINT
    """

    model = AuditLog
    serializer_class = AuditLogSerializer
    permission_classes = (IsAdminUser,)  # Allow any user with `is_staff=True`
    renderer_classes = (JSONRenderer,)
    queryset = AuditLog.objects.all()
    filter_backends = (SearchFilter,)

    search_default_field_lookups = [
        'app_label__icontains',
        'model_name__icontains',
        'metadata__icontains',
    ]
