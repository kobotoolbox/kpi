from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kobo.apps.subsequences.utils.deprecation import WritableAdvancedFeaturesField
from kpi.fields import (
    PaginatedApiField,
    RelativePrefixHyperlinkedRelatedField,
    WritableJSONField,
)


class AccessTypeField(serializers.SerializerMethodField):
    pass


class AdvancedFeatureField(WritableAdvancedFeaturesField):
    pass


class AdvancedSubmissionSchemaField(serializers.SerializerMethodField):
    pass


class AnalysisFormJsonField(serializers.SerializerMethodField):
    pass


class AssetCloneField(serializers.CharField):
    pass


class AssetFieldsField(serializers.ListField):
    pass


class AssetSettingsField(serializers.JSONField):
    pass


class AssetURLField(serializers.URLField):
    pass


class AssignablePermissionField(serializers.SerializerMethodField):
    pass


class BulkActionField(WritableJSONField):
    pass


class BulkAssetConfirmField(serializers.BooleanField):
    pass


class BulkAssetUidsField(serializers.JSONField):
    pass


class ChildrenField(serializers.SerializerMethodField):
    pass


class ContentDataField(WritableJSONField):
    pass


class ContentField(WritableJSONField):
    pass


class CountDailySubmissionResponseField(serializers.JSONField):
    pass


class DataSharingField(WritableJSONField):
    pass


class DataURLField(serializers.SerializerMethodField):
    pass


class DeployedVersionsField(PaginatedApiField):
    pass


class DeploymentActiveField(serializers.SerializerMethodField):
    pass


class DeploymentDataDownloadLinksField(serializers.SerializerMethodField):
    pass


class DeploymentLinkField(serializers.SerializerMethodField):
    pass


class DeploymentSubmissionCountField(serializers.SerializerMethodField):
    pass


class DownloadsField(serializers.SerializerMethodField):
    pass


class EffectivePermissionField(serializers.SerializerMethodField):
    pass


class ExportsURLField(serializers.SerializerMethodField):
    pass


class FileListField(serializers.SerializerMethodField):
    pass


class HasDeploymentField(serializers.ReadOnlyField):
    pass


class HooksUrlField(serializers.SerializerMethodField):
    pass


class MapCustomField(WritableJSONField):
    pass


class MapStylesField(WritableJSONField):
    pass


class MetadataListField(serializers.ListField):
    pass


class MetadataSectorField(serializers.ListField):
    pass


class OwnerURLField(RelativePrefixHyperlinkedRelatedField):
    pass


class PairedDataURLField(serializers.SerializerMethodField):
    pass


class ParentURLField(RelativePrefixHyperlinkedRelatedField):
    pass


class PermissionsField(serializers.SerializerMethodField):
    pass


class ReportCustomField(WritableJSONField):
    pass


class ReportListField(serializers.JSONField):
    pass


class ReportStyleField(WritableJSONField):
    pass


class ReportURLField(serializers.URLField):
    pass


class SettingsField(WritableJSONField):
    pass


class SubscribersCountField(serializers.SerializerMethodField):
    pass


class SummaryField(serializers.ReadOnlyField):
    pass


class AssetHyperlinkedURLField(HyperlinkedIdentityField):
    pass


class ValidContentDataField(serializers.JSONField):
    pass


class VersionCountField(serializers.SerializerMethodField):
    pass


class XFormLinkField(serializers.SerializerMethodField):
    pass


class XLSLinkField(serializers.SerializerMethodField):
    pass


def generic_uid_field(uid: str):
    return serializers.CharField(default=uid)
