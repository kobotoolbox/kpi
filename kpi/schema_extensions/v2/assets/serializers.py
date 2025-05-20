from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetCloneField,
    AssetSettingsField,
    AssetUpdateField,
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
    XFormField,
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


AssetBulkRequest = inline_serializer_class(
    name='AssetBulkRequest',
    fields={
        'asset_uids': BulkAssetUidsField(),
        'confirm': BulkAssetConfirmField(),
        'action': BulkActionField(),
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
        'uid': serializers.CharField(),
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


AssetUpdateRequest = inline_serializer_class(
    name='AssetUpdateRequest',
    fields={
        'data_sharing': AssetUpdateField(),
    },
)


AssetValidContentResponse = inline_serializer_class(
    name='ContentResponse',
    fields={
        'kind': serializers.CharField(),
        'uid': serializers.CharField(),
        'data': ValidContentDataField(),
    },
)


AssetXFormResponse = inline_serializer_class(
    name='XFormResponse',
    fields={
        'html': XFormField(),
    },
)

