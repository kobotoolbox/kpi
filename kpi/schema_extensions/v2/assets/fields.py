from rest_framework import serializers

from kpi.fields import (
    WritableJSONField,
)


class AccessTypeField(serializers.ListField):
    pass


class AdvancedFeatureField(serializers.JSONField):
    pass


class AdvancedSubmissionSchemaField(serializers.JSONField):
    pass


class AnalysisFormJsonField(serializers.JSONField):
    pass


class AssetCloneField(serializers.CharField):
    pass


class AssetFieldsField(serializers.ListField):
    pass


class AssetSettingsField(serializers.JSONField):
    pass


class AssetURLField(serializers.URLField):
    pass


class AssignablePermissionField(serializers.ListField):
    pass


class BulkActionField(WritableJSONField):
    pass


class BulkAssetConfirmField(serializers.BooleanField):
    pass


class BulkAssetUidsField(serializers.JSONField):
    pass


class ChildrenField(serializers.JSONField):
    pass


class ContentDataField(WritableJSONField):
    pass


class ContentField(serializers.JSONField):
    pass


class CountDailySubmissionResponseField(serializers.JSONField):
    pass


class CountriesField(serializers.ListField):
    pass


class DataSharingField(serializers.JSONField):
    pass


class DataURLField(serializers.URLField):
    pass


class DeployedVersionsField(serializers.JSONField):
    pass


class DeploymentDataDownloadLinksField(serializers.JSONField):
    pass


class DeploymentLinkField(serializers.JSONField):
    pass


class DownloadsField(serializers.JSONField):
    pass


class EffectivePermissionField(serializers.SerializerMethodField):
    pass


class ExportsURLField(serializers.URLField):
    pass


class FileListField(serializers.ListField):
    pass


class HasDeploymentField(serializers.BooleanField):
    pass


class HooksUrlField(serializers.URLField):
    pass


class MapCustomField(serializers.JSONField):
    pass


class MapStylesField(serializers.JSONField):
    pass


class MetadataListField(serializers.ListField):
    pass


class MetadataSectorField(serializers.ListField):
    pass


class UserURLRelativeHyperlinkedRelatedField(serializers.URLField):
    pass


class PairedDataURLField(serializers.URLField):
    pass


class ParentURLField(serializers.URLField):
    pass


class PermissionsField(serializers.ListField):
    pass


class ReportCustomField(serializers.JSONField):
    pass


class ReportListField(serializers.JSONField):
    pass


class ReportStyleField(serializers.JSONField):
    pass


class ReportURLField(serializers.URLField):
    pass


class SettingsField(serializers.JSONField):
    pass


class SummaryField(serializers.JSONField):
    pass


class AssetHyperlinkedURLField(serializers.URLField):
    pass


class UIDField(serializers.CharField):
    pass


class ValidContentDataField(serializers.JSONField):
    pass


class XFormLinkField(serializers.URLField):
    pass


class XLSLinkField(serializers.URLField):
    pass
