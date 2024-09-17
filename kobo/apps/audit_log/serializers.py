from django.contrib.auth import get_user_model
from rest_framework import serializers

from kpi.fields.username_hyperlinked import UsernameHyperlinkField
from .models import AuditAction, AuditLog


class AuditLogSerializer(serializers.ModelSerializer):

    user = serializers.HyperlinkedRelatedField(
        queryset=get_user_model().objects.all(),
        lookup_field='username',
        view_name='user-kpi-detail',
    )
    date_created = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            'app_label',
            'model_name',
            'object_id',
            'user',
            'user_uid',
            'username',
            'action',
            'metadata',
            'date_created',
            'log_type',
        )

        read_only_fields = (
            'app_label',
            'model_name',
            'object_id',
            'user',
            'user_uid',
            'username',
            'action',
            'metadata',
            'date_created',
            'log_type',
        )

    def get_date_created(self, audit_log):
        return audit_log.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_username(self, audit_log):
        return audit_log.user.username

class AccessLogSerializer(serializers.Serializer):

    user = UsernameHyperlinkField(source='user__username')
    date_created = serializers.SerializerMethodField()
    username = serializers.CharField(source='user__username')
    metadata = serializers.JSONField()
    user_uid = serializers.CharField()
    count = serializers.IntegerField()

    def get_date_created(self, audit_log):
        return audit_log['date_created'].strftime('%Y-%m-%dT%H:%M:%SZ')

