from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, viewsets

from kobo.apps.audit_log.permissions import SuperUserPermission
from kpi.models.user_reports import UserReports
from kpi.paginators import LimitStartPagination
from kpi.permissions import IsAuthenticated
from kpi.schema_extensions.v2.user_reports.serializers import UserReportsListResponse
from kpi.serializers.v2.user_reports import UserReportsSerializer
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response


@extend_schema(
    tags=['User Reports'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'user_reports/list.md'),
        responses=open_api_200_ok_response(
            UserReportsListResponse,
            require_auth=False,
            raise_not_found=False,
        ),
    ),
)
class UserReportsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Available actions:
    - list          → GET     /api/v2/user-reports/

    Documentation:
    - docs/api/v2/users_reports/list.md
    """

    queryset = UserReports.objects.all()
    serializer_class = UserReportsSerializer
    pagination_class = LimitStartPagination
    permission_classes = (IsAuthenticated, SuperUserPermission)
