from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetDownloadField,
    AssetLanguageField,
    AssetSettingsField,
    AssetsExportURLField,
    AssetsURLField,
    ExportResponseResult,
    GenericListField,
    UrlField,
    UserExportURLField,
    UserMetadataField,
    UserURLField,
)

ProjectViewAssetResponse = inline_serializer_class(
    name='ProjectViewAssetResponse',
    fields={
        'url': AssetsURLField(),
        'date_created': serializers.DateTimeField(),
        'date_modified': serializers.DateTimeField(),
        'date_deployed': serializers.DateTimeField(),
        'owner': UserURLField(),
        'owner__username': serializers.CharField(),
        'owner__email': serializers.EmailField(),
        'owner__name': serializers.CharField(),
        'owner__organization': serializers.CharField(),
        'uid': serializers.CharField(),
        'name': serializers.CharField(),
        'settings': AssetSettingsField(),
        'languages': AssetLanguageField(),
        'has_deployment': serializers.BooleanField(),
        'deployment__active': serializers.BooleanField(),
        'deployment__submission_count': serializers.IntegerField(),
        'deployment_status': serializers.CharField(),
        'asset_type': serializers.CharField(),
        'downloads': AssetDownloadField(),
        'owner_label': serializers.CharField(),
    },
)


ProjectViewExportCreateResponse = inline_serializer_class(
    name='ProjectViewExportCreateResponse',
    fields={
        'status': serializers.CharField(max_length=32),
    },
)


ProjectViewExportResponse = inline_serializer_class(
    name='ProjectViewExportResponse',
    fields={
        'status': serializers.CharField(max_length=32),
        'result': ExportResponseResult(),
    },
)


ProjectViewListResponse = inline_serializer_class(
    name='ProjectViewListResponse',
    fields={
        'uid': serializers.CharField(max_length=32),
        'name': ExportResponseResult(),
        'url': UrlField(),
        'assets': AssetsURLField(),
        'assets_export': AssetsExportURLField(),
        'users': UserURLField(),
        'users_export': UserExportURLField(),
        'countries': GenericListField(),
        'permissions': GenericListField(),
        'assigned_users': GenericListField(),
    },
)


ProjectViewUserResponse = inline_serializer_class(
    name='ProjectViewUserResponse',
    fields={
        'id': serializers.IntegerField(),
        'username': serializers.CharField(),
        'is_superuser': serializers.BooleanField(),
        'date_joined': serializers.DateTimeField(),
        'last_login': serializers.DateTimeField(),
        'is_active': serializers.BooleanField(),
        'email': serializers.EmailField(),
        'asset_count': serializers.IntegerField(),
        'metadata': UserMetadataField(),
    },
)
