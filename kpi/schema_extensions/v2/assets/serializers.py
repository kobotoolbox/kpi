from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetCloneField,
    AssetSettingsField,
    BulkActionField,
    BulkAssetConfirmField,
    BulkAssetUidsField,
    ContentDataField,
    CountDailySubmissionResponseField,
    MetadataListField,
    MetadataSectorField,
    ReportListField,
    ReportURLField,
    ValidContentDataField,
    generic_uid_field,
)

AssetCreateRequest = inline_serializer_class(
    name='AssetCreateRequest',
    fields={
        'name': serializers.CharField(),
        'clone_from': AssetCloneField(),
        'settings': AssetSettingsField(),
        'asset_type': serializers.CharField(),
    },
)


AssetPatchRequest = inline_serializer_class(
    name='AssetPatchRequest',
    fields={
        'content': serializers.CharField(),
        'name': serializers.CharField(),
        'enabled': serializers.BooleanField(),
        'fields': serializers.CharField(),
    },
)


AssetBulkRequest = inline_serializer_class(
    name='AssetBulkRequest',
    fields={
        'asset_uids': BulkAssetUidsField(),
        'confirm': BulkAssetConfirmField(),
        'action': BulkActionField(),
    },
)


AssetBulkResponse = inline_serializer_class(
    name='AssetBulkResponse',
    fields={
        'detail': serializers.CharField(),
    },
)


AssetCountResponse = inline_serializer_class(
    name='AssetCountResponse',
    fields={
        'daily_submission_count': CountDailySubmissionResponseField(),
        'total_submission_count': serializers.IntegerField(),
    },
)


AssetContentResponse = inline_serializer_class(
    name='ContentResponse',
    fields={
        'kind': serializers.CharField(),
        'uid': generic_uid_field(uid='akJTPb4JLVFqXMqYhKiPXZ'),
        'data': ContentDataField(),
    },
)


AssetHashResponse = inline_serializer_class(
    name='HashResponse',
    fields={
        'hash': serializers.CharField(),
    },
)


AssetMetadataResponse = inline_serializer_class(
    name='AssetMetadataResponse',
    fields={
        'languages': MetadataListField(),
        'countries': MetadataListField(),
        'sectors': MetadataSectorField(),
        'organizations': MetadataListField(),
    },
)


AssetReportResponse = inline_serializer_class(
    name='ReportResponse',
    fields={
        'url': ReportURLField(),
        'count': serializers.IntegerField(),
        'list': ReportListField(),
    },
)


AssetValidContentResponse = inline_serializer_class(
    name='AssetValidContentResponse',
    fields={
        'kind': serializers.CharField(),
        'uid': generic_uid_field(uid='akJTPb4JLVFqXMqYhKiPXZ'),
        'data': ValidContentDataField(),
    },
)
