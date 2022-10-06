from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.reverse import reverse

from .models import AuditLog, AuditMethod


class AuditLogSerializer(serializers.ModelSerializer):

    user = serializers.HyperlinkedRelatedField(
        queryset=get_user_model().objects.all(),
        lookup_field='username',
        view_name='user-detail'
    )
    date_created = serializers.SerializerMethodField()
    method = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = (
            'app_label',
            'model_name',
            'object_id',
            'user',
            'method',
            'metadata',
            'date_created',
        )

        read_only_fields = (
            'app_label',
            'model_name',
            'object_id',
            'user',
            'method',
            'metadata',
            'date_created',
        )

    def get_method(self, audit_log):
        return AuditMethod(audit_log.method).label

    def get_date_created(self, audit_log):
        return audit_log.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')
