from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AuditLog, AuditAction


class AuditLogSerializer(serializers.ModelSerializer):

    user = serializers.HyperlinkedRelatedField(
        queryset=get_user_model().objects.all(),
        lookup_field='username',
        view_name='user-kpi-detail'
    )
    date_created = serializers.SerializerMethodField()
    action = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            'app_label',
            'model_name',
            'object_id',
            'user',
            'user_uid',
            'action',
            'metadata',
            'date_created',
        )

        read_only_fields = (
            'app_label',
            'model_name',
            'object_id',
            'user',
            'user_uid',
            'action',
            'metadata',
            'date_created',
        )

    def get_action(self, audit_log):
        return AuditAction(audit_log.action).label

    def get_date_created(self, audit_log):
        return audit_log.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')
