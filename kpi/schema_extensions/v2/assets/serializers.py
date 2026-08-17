from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetCloneField,
    AssetFieldsField,
    AssetSettingsField,
    BulkActionField,
    BulkAssetConfirmField,
    BulkAssetUidsField,
    ContentDataField,
    CountDailySubmissionResponseField,
    CountriesField,
    MetadataListField,
    MetadataSectorField,
    ReportListField,
    ReportURLField,
    UIDField,
    ValidContentDataField,
)

AssetCreateRequestClone = inline_serializer_class(
    name='AssetCreateRequestClone',
    fields={
        'name': serializers.CharField(),
        'clone_from': AssetCloneField(),
        'asset_type': serializers.CharField(),
    },
)

AssetCreateRequestSettings = inline_serializer_class(
    name='AssetCreateRequestSettings',
    fields={
        'name': serializers.CharField(),
        'settings': AssetSettingsField(),
        'asset_type': serializers.CharField(),
    },
)

AssetCreateRequest = PolymorphicProxySerializer(
    component_name='AssetCreateRequest',
    serializers=[
        AssetCreateRequestClone,
        AssetCreateRequestSettings,
    ],
    resource_type_field_name=None,
)


AssetPatchRequestContent = inline_serializer_class(
    name='AssetPatchRequestContent',
    fields={
        'content': serializers.CharField(),
        'name': serializers.CharField(),
    },
)

AssetPatchRequestDataSharingFields = inline_serializer_class(
    name='AssetPatchRequestDataSharingFields',
    fields={
        'enabled': serializers.BooleanField(),
        'fields': AssetFieldsField(),
    },
)

AssetPatchRequestDataSharing = inline_serializer_class(
    name='AssetPatchRequestDataSharing',
    fields={
        'data_sharing': AssetPatchRequestDataSharingFields(),
    },
)

AssetPatchRequestTagString = inline_serializer_class(
    name='AssetPatchRequestTagString',
    fields={
        'tag_string': serializers.CharField(),
    },
)

AssetPatchRequest = PolymorphicProxySerializer(
    component_name='AssetPatchRequest',
    serializers=[
        AssetPatchRequestContent,
        AssetPatchRequestDataSharing,
        AssetPatchRequestTagString,
    ],
    resource_type_field_name=None,
)


AssetBulkRequestWithUids = inline_serializer_class(
    name='AssetBulkRequestWithUids',
    fields={
        'asset_uids': BulkAssetUidsField(),
        'action': BulkActionField(),
    },
)

AssetBulkRequestWithConfirm = inline_serializer_class(
    name='AssetBulkRequestWithConfirm',
    fields={
        'confirm': BulkAssetConfirmField(),
        'action': BulkActionField(),
    },
)

AssetBulkRequest = PolymorphicProxySerializer(
    component_name='AssetBulkRequest',
    serializers=[
        AssetBulkRequestWithUids,
        AssetBulkRequestWithConfirm,
    ],
    resource_type_field_name=None,
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
        'uid': UIDField(default='akJTPb4JLVFqXMqYhKiPXZ'),
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
        'countries': CountriesField(),
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
        'uid': UIDField(default='akJTPb4JLVFqXMqYhKiPXZ'),
        'data': ValidContentDataField(),
    },
)
