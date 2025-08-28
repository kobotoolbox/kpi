from rest_framework import viewsets
from kpi.models.user_reports import UserReports
from kpi.serializers.v2.user_reports import UserReportsSerializer


class UserReportsViewSet(viewsets.ModelViewSet):
    queryset = UserReports.objects.all()
    serializer_class = UserReportsSerializer
