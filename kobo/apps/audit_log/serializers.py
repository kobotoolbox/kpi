from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AuditAction, AuditLog, AuditType


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

class UsernameHyperlinkField(serializers.HyperlinkedRelatedField):
    """
    Special hyperlinked field to handle when a query returns a dict rather than a User object
    """
    queryset = get_user_model().objects.all()
    view_name = 'user-kpi-detail'

    def get_url(self, obj, view_name, request, format):
        return self.reverse(view_name, kwargs={'username': obj}, request=request, format=format)

class AccessLogSerializer(serializers.Serializer):

    user = UsernameHyperlinkField(source='user__username')
    date_created = serializers.SerializerMethodField()
    username = serializers.CharField(source='user__username')
    app_label = serializers.CharField()
    object_id = serializers.IntegerField()
    metadata = serializers.JSONField()
    model_name = serializers.CharField()
    user_uid = serializers.CharField()
    action = serializers.ChoiceField(choices=AuditAction.choices)
    log_type = serializers.ChoiceField(choices=AuditType.choices)
    count = serializers.SerializerMethodField()

    def get_date_created(self, audit_log):
        return audit_log['date_created'].strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_count(self, audit_log):
        # subtract one so submission groups don't count themselves as additional submissions
        return audit_log['count'] - 1


