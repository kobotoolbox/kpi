from rest_framework import viewsets
from kobo.apps.audit_log.permissions import SuperUserPermission
from kpi.models.user_reports import UserReports
from kpi.paginators import LimitStartPagination
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.user_reports import UserReportsSerializer


class UserReportsViewSet(viewsets.ModelViewSet):
    queryset = UserReports.objects.all()
    serializer_class = UserReportsSerializer
    pagination_class = LimitStartPagination
    permission_classes = (IsAuthenticated, SuperUserPermission)
