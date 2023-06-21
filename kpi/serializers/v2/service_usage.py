from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.http import Http404
from django.utils import timezone
from djstripe.models import Subscription
from rest_framework import serializers
from rest_framework.fields import empty

from kobo.apps.organizations.models import Organization, OrganizationUser
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.shadow_models import KobocatXForm, ReadOnlyKobocatDailyXFormSubmissionCounter
from kpi.deployment_backends.kobocat_backend import KobocatDeploymentBackend
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
    _now = timezone.now().date()

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
        start_date = self._now.replace(day=1)
        return self._get_nlp_tracking_data(asset, start_date)

    def get_nlp_usage_current_year(self, asset):
        start_date = self._now.replace(day=1, month=1)
        return self._get_nlp_tracking_data(asset, start_date)

    def get_nlp_usage_all_time(self, asset):
        return self._get_nlp_tracking_data(asset)

    def get_submission_count_current_month(self, asset):
        if not asset.has_deployment:
            return 0
        start_date = self._now.replace(day=1)
        return asset.deployment.submission_count_since_date(start_date)

    def get_submission_count_current_year(self, asset):
        if not asset.has_deployment:
            return 0
        start_date = self._now.replace(day=1, month=1)
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
        return KobocatDeploymentBackend.nlp_tracking_data(asset_ids=[asset.id], start_date=start_date)


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
    current_month_start = serializers.SerializerMethodField()
    current_year_start = serializers.SerializerMethodField()
    _now = timezone.now().date()

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
        self._current_month_start = None
        self._current_year_start = None
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

    def get_current_month_start(self, user):
        return self._current_month_start

    def get_current_year_start(self, user):
        return self._current_year_start

    def _get_per_asset_usage(self, user):
        users = [user]
        anchor_date, period_start, subscription_interval = None, None, None
        # Get the organization ID passed in from the query parameters
        organization_id = self.context['request'].query_params.get('organization_id')
        if organization_id:
            try:
                organization = Organization.objects.filter(
                    owner__organization_user__user=user,
                    id=organization_id,
                )
                # If the user is in an organization, get all org users so we can query their total org usage
                organization_users = OrganizationUser.objects.filter(organization=organization).select_related('user')
                users = [org_user.user.id for org_user in list(organization_users)]
            except ObjectDoesNotExist:
                # Couldn't find organization or organization users, raise an error
                raise Http404
            # Get the organization's subscription, if they have one
            subscription = Subscription.objects.filter(
                status__in=['active', 'past_due', 'trialing'],
                customer__subscriber=organization,
            ).first()
            # If they have a subscription, use its start date to calculate beginning of current month/year's usage
            if subscription:
                anchor_date = subscription.billing_cycle_anchor.date()
                period_start = subscription.current_period_start.date()
                subscription_interval = subscription.items.get().price.recurring['interval']
        # Only use fields we need to improve SQL query speed
        user_assets = Asset.objects.only(
            'pk', 'uid', '_deployment_data', 'owner_id', 'name',
        ).select_related('owner').filter(
            owner__in=users,
            asset_type=ASSET_TYPE_SURVEY,
            # Make sure we're only getting assets that are deployed
            _deployment_data__has_key='backend',
        )

        xforms = KobocatXForm.objects.filter(
            kpi_asset_uid__in=[user_asset.uid for user_asset in user_assets]
        )

        total_storage_bytes = xforms.aggregate(
            bytes_sum=Coalesce(Sum('attachment_storage_bytes'), 0),
        )
        self._total_storage_bytes = total_storage_bytes['bytes_sum'] or 0

        self._current_month_start = self._get_current_month_start_date(anchor_date, period_start, subscription_interval)
        self._current_year_start = self._get_current_year_start_date(anchor_date, period_start, subscription_interval)

        usage_types = {
            'all_time': None,
            'current_month': self._current_month_start,
            'current_year': self._current_year_start,
        }
        for usage_type, start_date in usage_types.items():
            range_filter = {}
            if start_date:
                range_filter['date__range'] = [start_date, self._now]
            submission_count = ReadOnlyKobocatDailyXFormSubmissionCounter.objects.filter(
                xform__in=xforms,
                **range_filter,
            ).aggregate(
                counter_sum=Coalesce(Sum('counter'), 0),
            )
            usage_key = f'_total_submission_count_{usage_type}'
            self.__dict__[usage_key] = submission_count['counter_sum'] or 0

            nlp_tracking = KobocatDeploymentBackend.nlp_tracking_data(user_assets, start_date)
            self.__dict__[f'_total_nlp_asr_seconds_{usage_type}'] = nlp_tracking['total_nlp_asr_seconds']
            self.__dict__[f'_total_nlp_mt_characters_{usage_type}'] = nlp_tracking['total_nlp_mt_characters']

    def _get_current_month_start_date(self, anchor_date=None, current_period=None, subscription_interval=None):
        if not (anchor_date and subscription_interval and current_period):
            # No subscription info, just use the first day of current month
            return self._now.replace(day=1)
        if subscription_interval == 'month':
            # Subscription is billed monthly, use the current billing period start date
            return current_period
        # Subscription is yearly, calculate the start date based on the anchor day
        anchor_day = anchor_date.day
        if self._now.day > anchor_day:
            return self._now.replace(day=anchor_day)
        start_year = self._now.year
        start_month = self._now.month - 1
        if start_month == 0:
            start_month = 12
            start_year -= 1
        return self._now.replace(day=anchor_day, month=start_month, year=start_year)

    def _get_current_year_start_date(self, anchor_date=None, current_period=None, subscription_interval=None):
        if not (anchor_date and subscription_interval and current_period):
            # No subscription info, just use the first day of current year
            return self._now.replace(day=1, month=1)
        if subscription_interval == 'year':
            # Subscription is billed yearly, use the provided anchor date as start date
            return current_period
        # Subscription is monthly, calculate this year's start based on anchor date
        if anchor_date.replace(year=self._now.year) > self._now:
            return anchor_date.replace(year=self._now.year - 1)
        return anchor_date.replace(year=self._now.year)
