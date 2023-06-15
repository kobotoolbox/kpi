from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from djstripe.models import Subscription
from rest_framework import serializers
from rest_framework.fields import empty

from kobo.apps.organizations.models import Organization, OrganizationUser
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models.asset import Asset


class AssetUsageSerializer(serializers.HyperlinkedModelSerializer):

    asset = serializers.HyperlinkedIdentityField(
        lookup_field='uid',
        view_name='asset-detail',
    )
    asset__name = serializers.ReadOnlyField(source='name')
    nlp_usage_current_month = serializers.SerializerMethodField()
    nlp_usage_current_year = serializers.SerializerMethodField()
    nlp_usage_all_time = serializers.SerializerMethodField()
    storage_bytes = serializers.SerializerMethodField()
    submission_count_current_month = serializers.SerializerMethodField()
    submission_count_current_year = serializers.SerializerMethodField()
    submission_count_all_time = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        lookup_field = 'uid'
        fields = (
            'asset',
            'asset__name',
            'nlp_usage_current_month',
            'nlp_usage_current_year',
            'nlp_usage_all_time',
            'storage_bytes',
            'submission_count_current_month',
            'submission_count_current_year',
            'submission_count_all_time',
        )

    def get_nlp_usage_current_month(self, asset):
        start_date = self._get_current_month_start_date()
        return self._get_nlp_tracking_data(asset, start_date)

    def get_nlp_usage_current_year(self, asset):
        start_date = self._get_current_year_start_date()
        return self._get_nlp_tracking_data(asset, start_date)

    def get_nlp_usage_all_time(self, asset):
        return self._get_nlp_tracking_data(asset)

    def get_submission_count_current_month(self, asset):
        if not asset.has_deployment:
            return 0
        start_date = self._get_current_month_start_date()
        return asset.deployment.submission_count_since_date(start_date)

    def get_submission_count_current_year(self, asset):
        if not asset.has_deployment:
            return 0
        start_date = self._get_current_year_start_date()
        return asset.deployment.submission_count_since_date(start_date)

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
        return asset.deployment.nlp_tracking_data(start_date)

    def _get_current_month_start_date(self):
        now = timezone.now()
        anchor_date = self.context.get('anchor_date')
        subscription_interval = self.context.get('subscription_interval')
        if anchor_date and subscription_interval:
            if subscription_interval == 'month':
                # Subscription is billed monthly, use the provided anchor date as start date
                return anchor_date
            # Subscription is yearly, calculate the start date based on the anchor day
            anchor_day = anchor_date.day
            if now.day > anchor_day:
                return now.replace(day=anchor_day)
            else:
                start_year = now.year
                start_month = now.month - 1
                if start_month == 0:
                    start_month = 12
                    start_year -= 1
                return now.replace(day=anchor_day, month=start_month, year=start_year).date()
        else:
            # No subscription info, just use the first day of current month
            return now.replace(day=1).date()

    def _get_current_year_start_date(self):
        now = timezone.now()
        anchor_date = self.context.get('anchor_date')
        subscription_interval = self.context.get('subscription_interval')
        if anchor_date and subscription_interval:
            if subscription_interval == 'year':
                # Subscription is billed yearly, use the provided anchor date as start date
                return anchor_date
            # Subscription is monthly, calculate 11 months before the anchor date
            anchor_date += relativedelta(months=-11)
            return anchor_date
        else:
            # No subscription info, just use the first day of current year
            return now.replace(day=1, month=1).date()


class ServiceUsageSerializer(serializers.Serializer):

    total_nlp_asr_seconds_all_time = serializers.SerializerMethodField()
    total_nlp_asr_seconds_current_month = serializers.SerializerMethodField()
    total_nlp_asr_seconds_current_year = serializers.SerializerMethodField()
    total_nlp_mt_characters_all_time = serializers.SerializerMethodField()
    total_nlp_mt_characters_current_month = serializers.SerializerMethodField()
    total_nlp_mt_characters_current_year = serializers.SerializerMethodField()
    total_storage_bytes = serializers.SerializerMethodField()
    total_submission_count_current_month = serializers.SerializerMethodField()
    total_submission_count_current_year = serializers.SerializerMethodField()
    total_submission_count_all_time = serializers.SerializerMethodField()

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)

        self._total_nlp_asr_seconds_all_time = 0
        self._total_nlp_asr_seconds_current_month = 0
        self._total_nlp_asr_seconds_current_year = 0
        self._total_nlp_mt_characters_all_time = 0
        self._total_nlp_mt_characters_current_month = 0
        self._total_nlp_mt_characters_current_year = 0
        self._total_storage_bytes = 0
        self._total_submission_count_all_time = 0
        self._total_submission_count_current_month = 0
        self._total_submission_count_current_year = 0
        self._get_per_asset_usage(instance)

    def get_total_nlp_asr_seconds_all_time(self, user):
        return self._total_nlp_asr_seconds_all_time

    def get_total_nlp_asr_seconds_current_month(self, user):
        return self._total_nlp_asr_seconds_current_month

    def get_total_nlp_asr_seconds_current_year(self, user):
        return self._total_nlp_asr_seconds_current_year

    def get_total_nlp_mt_characters_all_time(self, user):
        return self._total_nlp_mt_characters_all_time

    def get_total_nlp_mt_characters_current_month(self, user):
        return self._total_nlp_mt_characters_current_month

    def get_total_nlp_mt_characters_current_year(self, user):
        return self._total_nlp_mt_characters_current_year

    def get_total_submission_count_all_time(self, user):
        return self._total_submission_count_all_time

    def get_total_submission_count_current_month(self, user):
        return self._total_submission_count_current_month

    def get_total_submission_count_current_year(self, user):
        return self._total_submission_count_current_year

    def get_total_storage_bytes(self, user):
        return self._total_storage_bytes

    def _get_per_asset_usage(self, user):
        users = [user]
        anchor_date, subscription_interval = None, None
        # Get the user's organization if it exists
        organization = Organization.objects.filter(
            organization_users__user=user
        ).first()
        if organization:
            try:
                # If the user is in an organization, get all org users so we can query their total org usage
                organization_users = OrganizationUser.objects.filter(organization=organization).select_related('user')
                users = [org_user.user for org_user in list(organization_users)]
            except ObjectDoesNotExist:
                # Couldn't find organization/customer/subscription, proceed as if customer is not subscribed
                pass
            # Get the organization's subscription, if they have one
            subscription = Subscription.objects.filter(
                status__in=['active', 'past_due', 'trialing'],
                customer__subscriber=organization,
            ).first()
            # If they have a subscription, use its start date to calculate beginning of current month/year's usage
            if subscription:
                anchor_date = subscription.current_period_start
                subscription_interval = subscription.items.get().price.recurring['interval']
        # Only use fields we need to improve SQL query speed
        user_assets = Asset.objects.only(
            'pk', 'uid', '_deployment_data', 'owner_id', 'name'
        ).select_related('owner').filter(
            owner__in=users,
            asset_type=ASSET_TYPE_SURVEY,
        )
        # Pass the anchor day down to the AssetUsageSerializer
        asset_usage_context = {
            **self.context,
            'anchor_date': anchor_date,
            'subscription_interval': subscription_interval
        }

        self._per_asset_usage = AssetUsageSerializer(
            user_assets, many=True, read_only=True, context=asset_usage_context
        ).data

        for asset in self._per_asset_usage:
            self._total_storage_bytes += asset['storage_bytes']
            for usage_type in ['all_time', 'current_month', 'current_year']:
                submission_type = f'_total_submission_count_{usage_type}'
                self.__dict__[submission_type] += asset[f'submission_count_{usage_type}']
                nlp_usage = asset[f'nlp_usage_{usage_type}']
                nlp_keys = nlp_usage.keys()
                for key in nlp_keys:
                    if 'asr_seconds' in key:
                        nlp_counter_type = f'_total_nlp_asr_seconds_{usage_type}'
                        self.__dict__[nlp_counter_type] += nlp_usage[key]
                    if 'mt_characters' in key:
                        nlp_counter_type = f'_total_nlp_mt_characters_{usage_type}'
                        self.__dict__[nlp_counter_type] += nlp_usage[key]
