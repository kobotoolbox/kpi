from rest_framework import serializers
from rest_framework.fields import empty

from kpi.deployment_backends.kc_access.shadow_models import KobocatUserProfile
from kpi.models.asset import Asset


class AssetUsageSerializer(serializers.HyperlinkedModelSerializer):

    asset = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='asset-detail',
    )
    asset__name = serializers.ReadOnlyField(source='name')
    submission_count_current_month = serializers.SerializerMethodField()
    submission_count_all_time = serializers.SerializerMethodField()
    storage_bytes = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        lookup_field = 'uid'
        fields = (
            'asset',
            'asset__name',
            'submission_count_current_month',
            'submission_count_all_time',
            'storage_bytes',
        )

    def get_submission_count_current_month(self, asset):
        if not asset.has_deployment:
            return 0

        return asset.deployment.current_month_submission_count

    def get_submission_count_all_time(self, asset):
        if not asset.has_deployment:
            return 0

        return asset.deployment.submission_count

    def get_storage_bytes(self, asset):
        # Get value from asset deployment (if it has deployment)
        if not asset.has_deployment:
            return 0

        return asset.deployment.attachment_storage_bytes


class ServiceUsageSerializer(serializers.Serializer):

    per_asset_usage = serializers.SerializerMethodField()
    total_submission_count_current_month = serializers.SerializerMethodField()
    total_submission_count_all_time = serializers.SerializerMethodField()
    total_storage_bytes = serializers.SerializerMethodField()

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)

        self._total_storage_bytes = 0
        self._total_submission_count_all_time = 0
        self._total_submission_count_current_month = 0
        self._per_asset_usage = None
        self._get_per_asset_usage(instance)

    def get_per_asset_usage(self, user):
        return self._per_asset_usage

    def get_total_submission_count_all_time(self, user):
        return self._total_submission_count_all_time

    def get_total_submission_count_current_month(self, user):
        return self._total_submission_count_current_month

    def get_total_storage_bytes(self, user):
        return self._total_storage_bytes

    def _get_per_asset_usage(self, user):
        if not self._per_asset_usage:
            # Only use fields we need to improve SQL query speed
            user_assets = Asset.objects.only(
                'pk', 'uid', '_deployment_data', 'owner_id', 'name'
            ).select_related('owner').filter(owner=user)
            self._per_asset_usage = AssetUsageSerializer(
                user_assets, many=True, read_only=True, context=self.context
            ).data

            for asset in self._per_asset_usage:
                self._total_storage_bytes += asset['storage_bytes']
                self._total_submission_count_current_month += asset[
                    'submission_count_current_month'
                ]
                self._total_submission_count_all_time += asset[
                    'submission_count_all_time'
                ]

        return self._per_asset_usage
