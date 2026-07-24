import json

from django.contrib.auth import get_user_model
from drf_spectacular.plumbing import build_basic_type
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from kpi.fields import RelativePrefixHyperlinkedRelatedField
from .models import AuditLog, ProjectHistoryLog


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
            'user',
            'user_uid',
            'username',
            'action',
            'metadata',
            'date_created',
            'log_type',
        )

    @extend_schema_field(build_basic_type(OpenApiTypes.DATETIME))
    def get_date_created(self, audit_log):
        return audit_log.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')

    @extend_schema_field(build_basic_type(OpenApiTypes.STR))
    def get_username(self, audit_log):
        return getattr(audit_log.user, 'username', None)


class AccessLogSerializer(serializers.Serializer):
    user = RelativePrefixHyperlinkedRelatedField(
        view_name='user-kpi-detail',
        lookup_field='user__username',
        lookup_url_kwarg='username',
        read_only=True,
        source='user__username',
        allow_null=True,
    )
    date_created = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    metadata = serializers.JSONField()
    user_uid = serializers.CharField(allow_blank=True)
    count = serializers.IntegerField()
    action = serializers.CharField()

    @extend_schema_field(build_basic_type(OpenApiTypes.DATETIME))
    def get_date_created(self, audit_log):
        return audit_log['date_created'].strftime('%Y-%m-%dT%H:%M:%SZ')

    @extend_schema_field(build_basic_type(OpenApiTypes.STR))
    def get_username(self, audit_log):
        username = audit_log.get('user__username')
        if not username:
            metadata = audit_log.get('metadata', {})
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except ValueError:
                    metadata = {}
            username = metadata.get('attempted_username')
        return username


class ProjectHistoryLogSerializer(AuditLogSerializer):

    class Meta:
        model = ProjectHistoryLog
        fields = (
            'user',
            'user_uid',
            'username',
            'action',
            'metadata',
            'date_created',
        )

        read_only_fields = (
            'user',
            'user_uid',
            'username',
            'action',
            'metadata',
            'date_created',
        )
