from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers
from rest_framework.fields import empty

from kobo.apps.organizations.models import Organization
from kobo.apps.project_views.models.assignment import User
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatXForm,
    ReadOnlyKobocatDailyXFormSubmissionCounter,
)
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
        return KobocatDeploymentBackend.nlp_tracking_data(
            asset_ids=[asset.id], start_date=start_date
        )


class ServiceUsageSerializer(serializers.Serializer):
    total_nlp_usage = serializers.SerializerMethodField()
    total_storage_bytes = serializers.SerializerMethodField()
    total_submission_count = serializers.SerializerMethodField()
    current_month_start = serializers.SerializerMethodField()
    current_year_start = serializers.SerializerMethodField()
    billing_period_end = serializers.SerializerMethodField()
    _now = timezone.now().date()

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)

        self._total_nlp_usage = {}
        self._total_storage_bytes = 0
        self._total_submission_count = {}
        self._current_month_start = None
        self._current_year_start = None
        self._anchor_date = None
        self._period_start = None
        self._period_end = None
        self._subscription_interval = None
        self._get_per_asset_usage(instance)

    def get_total_nlp_usage(self, user):
        return self._total_nlp_usage

    def get_total_submission_count(self, user):
        return self._total_submission_count

    def get_total_storage_bytes(self, user):
        return self._total_storage_bytes

    def get_current_month_start(self, user):
        return self._current_month_start

    def get_current_year_start(self, user):
        return self._current_year_start

    def get_billing_period_end(self, user):
        return self._period_end

    def _get_current_month_start_date(self):
        # No subscription info, just use the first day of current month
        if not self._anchor_date:
            return self._now.replace(day=1)

        # Subscription is billed monthly, use the current billing period start date
        if self._subscription_interval == 'month':
            return self._period_start

        # Subscription is yearly, calculate the start date based on the anchor day
        anchor_day = self._anchor_date.day
        if self._now.day > anchor_day:
            return self._now.replace(day=anchor_day)
        start_year = self._now.year
        start_month = self._now.month - 1
        if start_month == 0:
            start_month = 12
            start_year -= 1
        return self._now.replace(
            day=anchor_day, month=start_month, year=start_year
        )

    def _get_current_year_start_date(self):
        # No subscription info, just use the first day of current year
        if not self._anchor_date:
            return self._now.replace(day=1, month=1)

        # Subscription is billed yearly, use the provided anchor date as start date
        if self._subscription_interval == 'year':
            return self._period_start

        # Subscription is monthly, calculate this year's start based on anchor date
        if self._anchor_date.replace(year=self._now.year) > self._now:
            return self._anchor_date.replace(year=self._now.year - 1)
        return self._anchor_date.replace(year=self._now.year)

    def _get_nlp_user_counters(self, month_filter, year_filter):
        nlp_tracking = (
            NLPUsageCounter.objects.only(
                'date', 'total_asr_seconds', 'total_mt_characters'
            )
            .filter(
                user_id__in=self._user_ids,
            )
            .aggregate(
                asr_seconds_current_year=Coalesce(
                    Sum('total_asr_seconds', filter=year_filter), 0
                ),
                mt_characters_current_year=Coalesce(
                    Sum('total_mt_characters', filter=year_filter), 0
                ),
                asr_seconds_current_month=Coalesce(
                    Sum('total_asr_seconds', filter=month_filter), 0
                ),
                mt_characters_current_month=Coalesce(
                    Sum('total_mt_characters', filter=month_filter), 0
                ),
                asr_seconds_all_time=Coalesce(Sum('total_asr_seconds'), 0),
                mt_characters_all_time=Coalesce(Sum('total_mt_characters'), 0),
            )
        )

        for nlp_key, count in nlp_tracking.items():
            self._total_nlp_usage[nlp_key] = count if count is not None else 0

    def _get_organization_details(self):
        # Get the organization ID from the request
        organization_id = self.context.get(
            'organization_id', None
        )

        if not organization_id:
            return

        organization = Organization.objects.filter(
            owner__organization_user__user=self.context.get('request').user,
            id=organization_id,
        ).first()

        if not organization:
            # Couldn't find organization, proceed as normal
            return

        """
        Commented out until the Enterprise plan is implemented

        # If the user is in an organization, get all org users so we can query their total org usage
        self._user_ids = list(
            User.objects.values_list('pk', flat=True).filter(
                organizations_organization__id=organization_id
            )
        )
        """

        # If they have a subscription, use its start date to calculate beginning of current month/year's usage
        billing_details = organization.active_subscription_billing_details
        if billing_details:
            self._anchor_date = billing_details['billing_cycle_anchor'].date()
            self._period_start = billing_details['current_period_start'].date()
            self._period_end = billing_details['current_period_end'].date()
            self._subscription_interval = billing_details['recurring_interval']

    def _get_per_asset_usage(self, user):
        self._user_ids = [user.pk]

        self._get_organization_details()

        self._get_storage_usage()

        self._current_month_start = self._get_current_month_start_date()
        self._current_year_start = self._get_current_year_start_date()

        current_month_filter = Q(
            date__range=[self._current_month_start, self._now]
        )
        current_year_filter = Q(
            date__range=[self._current_year_start, self._now]
        )

        self._get_submission_counters(current_month_filter, current_year_filter)
        self._get_nlp_user_counters(current_month_filter, current_year_filter)

    def _get_storage_usage(self):
        """
        Get the storage used by non-(soft-)deleted projects for all users

        Users are represented by their ids with `self._user_ids`
        """
        xforms = (
            KobocatXForm.objects.only('bytes_sum', 'id')
            .filter(user_id__in=self._user_ids)
            .exclude(pending_delete=True)
        )

        total_storage_bytes = xforms.aggregate(
            bytes_sum=Coalesce(Sum('attachment_storage_bytes'), 0),
        )

        self._total_storage_bytes = total_storage_bytes['bytes_sum'] or 0

    def _get_submission_counters(self, month_filter, year_filter):
        """
        Calculate submissions for all users' projects even their deleted ones

        Users are represented by their ids with `self._user_ids`
        """
        submission_count = (
            ReadOnlyKobocatDailyXFormSubmissionCounter.objects.filter(
                user_id__in=self._user_ids,
            )
            .aggregate(
                all_time=Coalesce(Sum('counter'), 0),
                current_year=Coalesce(
                    Sum('counter', filter=year_filter), 0
                ),
                current_month=Coalesce(
                    Sum('counter', filter=month_filter), 0
                ),
            )
        )

        for submission_key, count in submission_count.items():
            self._total_submission_count[submission_key] = (
                count if count is not None else 0
            )
