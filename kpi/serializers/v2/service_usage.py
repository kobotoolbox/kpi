from django.conf import settings
from django.db.models import Sum, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import serializers
from rest_framework.fields import empty

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.utils import organization_month_start, organization_year_start
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatXForm,
    KobocatDailyXFormSubmissionCounter,
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

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)
        organization = self.context.get('organization')
        self._month_start = organization_month_start(organization)
        self._year_start = organization_year_start(organization)

    def get_nlp_usage_current_month(self, asset):
        return self._get_nlp_tracking_data(asset, self._month_start)

    def get_nlp_usage_current_year(self, asset):
        return self._get_nlp_tracking_data(asset, self._year_start)

    def get_nlp_usage_all_time(self, asset):
        return self._get_nlp_tracking_data(asset)

    def get_submission_count_current_month(self, asset):
        if not asset.has_deployment:
            return 0
        return asset.deployment.submission_count_since_date(self._month_start)

    def get_submission_count_current_year(self, asset):
        if not asset.has_deployment:
            return 0
        return asset.deployment.submission_count_since_date(self._year_start)

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
    current_month_start = serializers.SerializerMethodField()
    current_year_start = serializers.SerializerMethodField()
    billing_period_end = serializers.SerializerMethodField()

    def __init__(self, instance=None, data=empty, **kwargs):
        super().__init__(instance=instance, data=data, **kwargs)

        self._total_nlp_usage = {}
        self._total_storage_bytes = 0
        self._total_submission_count = {}
        self._current_month_start = None
        self._current_year_start = None
        self._organization = None
        self._period_end = None
        self._now = timezone.now()
        self._get_per_asset_usage(instance)

    def get_total_nlp_usage(self, user):
        return self._total_nlp_usage

    def get_total_submission_count(self, user):
        return self._total_submission_count

    def get_total_storage_bytes(self, user):
        return self._total_storage_bytes

    def get_current_month_start(self, user):
        return self._current_month_start.isoformat()

    def get_current_year_start(self, user):
        return self._current_year_start.isoformat()

    def get_billing_period_end(self, user):
        if self._period_end is None:
            return None
        return self._period_end.isoformat()

    def _filter_by_user(self, user_ids: list) -> Q:
        """
        Turns a list of user ids into a query object to filter by
        """
        return Q(user_id__in=user_ids)

    def _get_nlp_user_counters(self, month_filter, year_filter):
        nlp_tracking = NLPUsageCounter.objects.only(
            'date', 'total_asr_seconds', 'total_mt_characters'
        ).filter(self._user_id_query).aggregate(
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

        for nlp_key, count in nlp_tracking.items():
            self._total_nlp_usage[nlp_key] = count if count is not None else 0

    def _get_organization_details(self, user_id: int):
        # Get the organization ID from the request
        organization_id = self.context.get(
            'organization_id', None
        )

        if not organization_id:
            return

        self._organization = Organization.objects.filter(
            organization_users__user_id=user_id,
            id=organization_id,
        ).first()

        if not self._organization:
            # Couldn't find organization, proceed as normal
            return

        if settings.STRIPE_ENABLED:
            # if the user is in an organization and has an enterprise plan, get all org users
            # we evaluate this queryset instead of using it as a subquery because it's referencing
            # fields from the auth_user tables on kpi *and* kobocat, making getting results in a
            # single query not feasible until those tables are combined
            user_ids = list(
                User.objects.filter(
                    organizations_organization__id=organization_id,
                    organizations_organization__djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
                    organizations_organization__djstripe_customers__subscriptions__items__price__product__metadata__has_key='plan_type',
                    organizations_organization__djstripe_customers__subscriptions__items__price__product__metadata__plan_type='enterprise',
                ).values_list('pk', flat=True)[:settings.ORGANIZATION_USER_LIMIT]
            )
            if user_ids:
                self._user_id_query = self._filter_by_user(user_ids)

    def _get_per_asset_usage(self, user):
        self._user_id = user.pk
        self._user_id_query = self._filter_by_user([self._user_id])
        # get the billing data and list of organization users (if applicable)
        self._get_organization_details(self._user_id)

        self._get_storage_usage()

        self._current_month_start = organization_month_start(self._organization)
        self._current_year_start = organization_year_start(self._organization)

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
        xforms = KobocatXForm.objects.only('attachment_storage_bytes', 'id').exclude(
            pending_delete=True
        ).filter(self._user_id_query)

        total_storage_bytes = xforms.aggregate(
            bytes_sum=Coalesce(Sum('attachment_storage_bytes'), 0),
        )

        self._total_storage_bytes = total_storage_bytes['bytes_sum'] or 0

    def _get_submission_counters(self, month_filter, year_filter):
        """
        Calculate submissions for all users' projects even their deleted ones

        Users are represented by their ids with `self._user_ids`
        """
        submission_count = KobocatDailyXFormSubmissionCounter.objects.only(
            'counter', 'user_id'
        ).filter(self._user_id_query).aggregate(
            all_time=Coalesce(Sum('counter'), 0),
            current_year=Coalesce(
                Sum('counter', filter=year_filter), 0
            ),
            current_month=Coalesce(
                Sum('counter', filter=month_filter), 0
            ),
        )

        for submission_key, count in submission_count.items():
            self._total_submission_count[submission_key] = (
                count if count is not None else 0
            )
