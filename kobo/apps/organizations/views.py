from django.conf import settings
from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import QuerySet
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django_dont_vary_on.decorators import only_vary_on
from kpi import filters
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models.asset import Asset
from kpi.paginators import AssetUsagePagination
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.service_usage import (
    CustomAssetUsageSerializer,
    ServiceUsageSerializer,
)
from kpi.utils.object_permission import get_database_user
from .models import Organization, create_organization
from .permissions import IsOrgAdminOrReadOnly
from .serializers import OrganizationSerializer
from ..stripe.constants import ACTIVE_STRIPE_STATUSES


@method_decorator(cache_page(settings.ENDPOINT_CACHE_DURATION), name='service_usage')
# django uses the Vary header in its caching, and each middleware can potentially add more Vary headers
# we use this decorator to remove any Vary headers except 'origin' (we don't want to cache between different installs)
@method_decorator(only_vary_on('Origin'), name='service_usage')
class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Organizations are groups of users with assigned permissions and configurations

    - Organization admins can manage the organization and it's membership
    - Connect to authentication mechanisms and enforce policy
    - Create teams and projects under the organization
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    lookup_field = 'id'
    permission_classes = (IsAuthenticated, IsOrgAdminOrReadOnly)
    pagination_class = AssetUsagePagination

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        queryset = super().get_queryset().filter(users=user)
        if self.action == "list" and not queryset:
            # Very inefficient get or create queryset.
            # It's temporary and should be removed later.
            create_organization(user, f"{user.username}'s organization")
            queryset = queryset.all()  # refresh
        return queryset

    @action(detail=True, methods=['get'])
    def service_usage(self, request, pk=None, *args, **kwargs):
        """
        ## Organization Usage Tracker
        <p>Tracks the total usage of different services for each account in an organization</p>
        <p>Tracks the submissions and NLP seconds/characters for the current month/year/all time</p>
        <p>Tracks the current total storage used</p>
        <p>If no organization is found with the provided ID, returns the usage for the logged-in user</p>
        <strong>This endpoint is cached for an amount of time determined by ENDPOINT_CACHE_DURATION</strong>

        <pre class="prettyprint">
        <b>GET</b> /api/v2/organizations/{organization_id}/service_usage/
        </pre>

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/organizations/{organization_id}/service_usage/
        >       {
        >           "total_nlp_usage": {
        >               "asr_seconds_current_month": {integer},
        >               "asr_seconds_current_year": {integer},
        >               "asr_seconds_all_time": {integer},
        >               "mt_characters_current_month": {integer},
        >               "mt_characters_current_year": {integer},
        >               "mt_characters_all_time": {integer},
        >           },
        >           "total_storage_bytes": {integer},
        >           "total_submission_count": {
        >               "current_month": {integer},
        >               "current_year": {integer},
        >               "all_time": {integer},
        >           },
        >           "current_month_start": {string (date), ISO format},
        >           "current_year_start": {string (date), ISO format},
        >           "billing_period_end": {string (date), ISO format}|{None},
        >       }
        ### CURRENT ENDPOINT
        """

        context = {
            'organization_id': kwargs.get('id', None),
            **self.get_serializer_context(),
        }

        serializer = ServiceUsageSerializer(
            get_database_user(request.user),
            context=context,
        )
        return Response(data=serializer.data)

    @action(detail=True, methods=['get'])
    def asset_usage(self, request, pk=None, *args, **kwargs):
        """
        ## Organization Asset Usage Tracker
        <p>Tracks the total usage of each asset for the user in the given organization</p>

        <pre class="prettyprint">
        <b>GET</b> /api/v2/organizations/{organization_id}/asset_usage/
        </pre>

        > Example
        >
        >       curl -X GET https://[kpi]/api/v2/organizations/{organization_id}/asset_usage/
        >       {
        >           "count": {integer},
        >           "next": {url_to_next_page},
        >           "previous": {url_to_previous_page},
        >           "results": [
        >               {
        >                   "asset_type": {string},
        >                   "asset": {asset_url},
        >                   "asset_name": {string},
        >                   "nlp_usage_current_month": {
        >                       "total_asr_seconds": {integer},
        >                       "total_mt_characters": {integer},
        >                   }
        >                   "nlp_usage_all_time": {
        >                       "total_asr_seconds": {integer},
        >                       "total_mt_characters": {integer},
        >                   }
        >                   "storage_bytes": {integer},
        >                   "submission_count_current_month": {integer},
        >                   "submission_count_all_time": {integer},
        >                   "deployment_status": {string},
        >               },{...}
        >           ]
        >       }
        ### CURRENT ENDPOINT
        """

        org_id = kwargs.get('id', None)
        # Check if the organization exists and if the user is the owner
        try:
            organization = Organization.objects.prefetch_related('organization_users__user').filter(
                id=org_id, owner__organization_user__user_id=request.user.id,
            ).annotate(
                user_ids=ArrayAgg('organization_users__user_id')
            )[0]
        except IndexError:
            return Response(
                {'error': "There was a problem finding the organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # default to showing all users for this org
        asset_users = organization.user_ids
        # if Stripe is enabled, check that the org is on a plan that supports Organization features
        if settings.STRIPE_ENABLED and not Organization.objects.filter(
            id=org_id,
            djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
            djstripe_customers__subscriptions__items__price__product__metadata__has_key='plan_type',
            djstripe_customers__subscriptions__items__price__product__metadata__plan_type='enterprise',
        ).exists():
            # No active subscription that supports multiple users, just get this user's data
            asset_users = [request.user.id]

        assets = (
            Asset.objects.only(
                'pk',
                'uid',
                '_deployment_status',
                'owner_id',
            )
            .select_related('owner')
            .filter(
                owner__in=asset_users,
                asset_type=ASSET_TYPE_SURVEY,
            )
        )

        context = {
            'organization': organization,
            **self.get_serializer_context(),
        }

        filtered_assets = (
            filters.AssetOrganizationUsageFilter().filter_queryset(
                request, assets, self
            )
        )

        page = self.paginate_queryset(filtered_assets)

        serializer = CustomAssetUsageSerializer(
            page, many=True, context=context
        )
        return self.get_paginated_response(serializer.data)
