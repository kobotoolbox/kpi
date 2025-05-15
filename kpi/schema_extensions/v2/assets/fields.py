from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kobo.apps.subsequences.utils.deprecation import WritableAdvancedFeaturesField
from kpi.fields import WritableJSONField, RelativePrefixHyperlinkedRelatedField, \
    PaginatedApiField


class AdvancedFeatureField(WritableAdvancedFeaturesField):
    pass


class AdvancedSubmissionSchemaField(serializers.SerializerMethodField):
    pass


class AnalysisFormJsonField(serializers.SerializerMethodField):
    pass


class AssetURLField(serializers.URLField):
    pass


class AssignablePermissionField(serializers.SerializerMethodField):
    pass


class ChildrenField(serializers.SerializerMethodField):
    pass


class ContentField(WritableJSONField):
    pass


class DataSharingField(WritableJSONField):
    pass


class DataURLField(serializers.SerializerMethodField):
    pass


class DeploymentLinkField(serializers.SerializerMethodField):
    pass


class DeploymentActiveField(serializers.SerializerMethodField):
    pass


class DeploymentDataDownloadLinksField(serializers.SerializerMethodField):
    pass


class DeploymentSubmissionCountField(serializers.SerializerMethodField):
    pass


class DeployedVersionField(PaginatedApiField):
    pass


class DownloadsField(WritableJSONField):
    pass


class FileListField(serializers.SerializerMethodField):
    pass


class EffectivePermissionField(serializers.SerializerMethodField):
    pass


class ExportsURLField(serializers.SerializerMethodField):
    pass


class HasDeploymentField(serializers.ReadOnlyField):
    pass


class HooksUrlField(serializers.SerializerMethodField):
    pass


class MapStylesField(WritableJSONField):
    pass


class MapCustomField(WritableJSONField):
    pass


class UserURLField(HyperlinkedIdentityField):
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


class ReportStyleField(WritableJSONField):
    pass


class SettingsField(WritableJSONField):
    pass


class SubscribersCountField(serializers.SerializerMethodField):
    pass


class SummaryField(serializers.ReadOnlyField):
    pass


class VersionCountField(serializers.SerializerMethodField):
    pass


class XFormLinkField(serializers.SerializerMethodField):
    pass


class XLSLinkField(serializers.SerializerMethodField):
    pass
