from rest_framework import serializers
from kpi.models.user_reports import UserReports


class UserReportsSerializer(serializers.ModelSerializer):

    class Meta:
        model = UserReports
        fields = '__all__'
