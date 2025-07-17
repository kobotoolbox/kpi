from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    CeleryTask,
    MetadataField,
)

UserListResponse = inline_serializer_class(
    name='UserListResponse',
    fields={
        'id': serializers.IntegerField(),
        'username': serializers.CharField(),
        'is_superuser': serializers.BooleanField(),
        'date_joined': serializers.DateTimeField(),
        'last_login': serializers.DateTimeField(),
        'is_active': serializers.BooleanField(),
        'email': serializers.EmailField(),
        'asset_count': serializers.IntegerField(),
        'metadata': MetadataField(),
    },
)

MigrateResponse = inline_serializer_class(
    name='MigrateResponse',
    fields={
        'celery_task': CeleryTask(),
    }
)
