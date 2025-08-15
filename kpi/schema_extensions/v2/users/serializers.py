from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import MetadataField, UrlField

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


UserRetrieveResponse = inline_serializer_class(
    name='UserRetrieveResponse',
    fields={
        'url': UrlField(),
        'username': serializers.CharField(),
        'date_joined': serializers.DateTimeField(),
        'public_collection_subscribers_count': serializers.IntegerField(),
        'public_collections_count': serializers.IntegerField(),
    },
)
