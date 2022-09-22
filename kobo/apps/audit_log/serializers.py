from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.reverse import reverse

from .models import AuditLog, AuditMethod


class AuditLogSerializer(serializers.ModelSerializer):

    user = serializers.SerializerMethodField()
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

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)
        # Cache usernames to avoid multiple queries to DB
        self.usernames_ids_mapping = {
            u['pk']: u['username']
            for u in get_user_model().objects.values('pk', 'username').all()
        }

    def get_method(self, audit_log):
        return AuditMethod(audit_log.method).label

    def get_date_created(self, audit_log):
        return audit_log.date_created.strftime('%Y-%m-%dT%H:%M:%SZ')

    def get_user(self, audit_log):
        # We could have used a HyperlinkRelatedField to get the same result,
        # but DRF make a query to DB for each `audit_log` to retrieve the related
        # user.
        request = self.context['request']
        try:
            username = self.usernames_ids_mapping[audit_log.user_id]
        except KeyError:
            return None

        return reverse('user-detail', (username,), request=request)

    def get_uniqueness_extra_kwargs(self, field_names, declared_fields, extra_kwargs):
        extra_kwargs, hidden_fields = super().get_uniqueness_extra_kwargs(
            field_names, declared_fields, extra_kwargs
        )
        # Override DRF behaviour which ignores `method` field from the model
        # because a SerializerField name `method` is also declared in this class.
        # When this happens, DRF treats all fields included in unique constraints
        # as hidden fields and do not display them in the response.
        # See:
        # - https://github.com/encode/django-rest-framework/blob/2de50818296b1b4bae68787626c0236752e35101/rest_framework/serializers.py#L1052
        # - https://github.com/encode/django-rest-framework/blob/2de50818296b1b4bae68787626c0236752e35101/rest_framework/serializers.py#L1057-L1059
        # - https://github.com/encode/django-rest-framework/blob/2de50818296b1b4bae68787626c0236752e35101/rest_framework/serializers.py#L1459-L1463
        hidden_fields.pop('method', None)
        return extra_kwargs, hidden_fields
