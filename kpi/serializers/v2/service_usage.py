from rest_framework import serializers
from rest_framework.fields import empty

from kobo.apps.organizations.utils import get_billing_dates
from kpi.deployment_backends.openrosa_backend import OpenRosaDeploymentBackend
from kpi.models.asset import Asset
from kpi.utils.usage_calculator import ServiceUsageCalculator


class AssetUsageSerializer(serializers.HyperlinkedModelSerializer):
    asset = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='asset-detail',
    )
    asset__name = serializers.ReadOnlyField(source='name')
    nlp_usage_current_period = serializers.SerializerMethodField()
    nlp_usage_all_time = serializers.SerializerMethodField()
    storage_bytes = serializers.SerializerMethodField()
    submission_count_current_period = serializers.SerializerMethodField()
    submission_count_all_time = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        lookup_field = 'uid'
        fields = (
            'asset',
            'asset__name',
            'nlp_usage_current_period',
            'nlp_usage_all_time',
            'storage_bytes',
            'submission_count_current_period',
            'submission_count_all_time',
        )

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)
        organization = self.context.get('organization')
        self._period_start, _ = get_billing_dates(organization)

    def get_nlp_usage_current_period(self, asset):
        return self._get_nlp_tracking_data(asset, self._period_start)

    def get_nlp_usage_all_time(self, asset):
        return self._get_nlp_tracking_data(asset)

    def get_submission_count_current_period(self, asset):
        if not asset.has_deployment:
            return 0
        return asset.deployment.submission_count_since_date(self._period_start)

    def get_submission_count_all_time(self, asset):
        if not asset.has_deployment:
            return 0

        return asset.deployment.submission_count_since_date()

    def get_storage_bytes(self, asset):
        # Get value from asset deployment (if it has deployment)
        if not asset.has_deployment:
            return 0

        return asset.deployment.attachment_storage_bytes

    def _get_nlp_tracking_data(self, asset, start_date=None):
        if not asset.has_deployment:
            return {
                'total_nlp_asr_seconds': 0,
                'total_nlp_mt_characters': 0,
            }
        return OpenRosaDeploymentBackend.nlp_tracking_data(
            asset_ids=[asset.id], start_date=start_date
        )


class CustomAssetUsageSerializer(AssetUsageSerializer):
    deployment_status = serializers.SerializerMethodField()

    class Meta(AssetUsageSerializer.Meta):
        fields = AssetUsageSerializer.Meta.fields + ('deployment_status',)

    def get_deployment_status(self, asset):
        return asset.deployment_status


class ServiceUsageSerializer(serializers.Serializer):
    total_nlp_usage = serializers.SerializerMethodField()
    total_storage_bytes = serializers.SerializerMethodField()
    total_submission_count = serializers.SerializerMethodField()
    current_period_start = serializers.SerializerMethodField()
    current_period_end = serializers.SerializerMethodField()
    last_updated = serializers.SerializerMethodField()

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)
        self.calculator = ServiceUsageCalculator(user=instance)

    def get_current_period_end(self, user):
        return self.calculator.current_period_end.isoformat()

    def get_current_period_start(self, user):
        return self.calculator.current_period_start.isoformat()

    def get_last_updated(self, user):
        return self.calculator.get_last_updated().isoformat()

    def get_total_nlp_usage(self, user):
        return self.calculator.get_nlp_usage_counters()

    def get_total_submission_count(self, user):
        return self.calculator.get_submission_counters()

    def get_total_storage_bytes(self, user):
        return self.calculator.get_storage_usage()
