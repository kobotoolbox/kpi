from django.conf import settings
from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import (
    QuerySet,
    Case,
    When,
    Value,
    CharField,
    OuterRef,
)
from django.db.models.expressions import Exists
from django.utils.decorators import method_decorator
from django.utils.http import http_date
from django.views.decorators.cache import cache_page
from django_dont_vary_on.decorators import only_vary_on
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from kpi import filters
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.filters import AssetOrderingFilter, SearchFilter
from kpi.models.asset import Asset
from kpi.paginators import AssetUsagePagination, OrganizationMemberPagination
from kpi.permissions import IsAuthenticated
from kpi.serializers.v2.service_usage import (
    CustomAssetUsageSerializer,
    ServiceUsageSerializer,
)
from kpi.utils.object_permission import get_database_user
from kpi.views.v2.asset import AssetViewSet
from .models import Organization, OrganizationOwner, OrganizationUser
from .permissions import (
    IsOrgAdmin,
    IsOrgAdminOrReadOnly,
    IsOrgOwnerOrAdminOrMember
)
from .serializers import OrganizationSerializer, OrganizationUserSerializer
from ..accounts.mfa.models import MfaMethod
from ..stripe.constants import ACTIVE_STRIPE_STATUSES


class OrganizationAssetViewSet(AssetViewSet):
    """
    This class is specifically designed for the `assets` action of the
    OrganizationViewSet below.

    It overrides the queryset of the parent class (AssetViewSet), limiting
    results to assets owned by the organization. The `permission_classes`
    attribute is deliberately left empty to prevent duplicate permission checks
    with OrganizationViewSet.asset(). It relies on `permissions_checked` being
    passed as a `self.request` attribute to confirm that permissions have been
    properly validated beforehand.
    """

    permission_classes = []
    filter_backends = [
        SearchFilter,
        AssetOrderingFilter,
    ]

    def get_queryset(self, *args, **kwargs):
        if not getattr(self.request, 'permissions_checked', False):
            # Perform a sanity check to ensure that permissions have been properly
            # validated within `OrganizationViewSet.assets()`.
            raise AttributeError('`permissions_checked` is missing')

        queryset = super().get_queryset(*args, **kwargs)
        if self.action == 'list':
            return queryset.filter(
                owner=self.request.user.organization.owner_user_object
            )
        else:
            raise NotImplementedError


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

    @action(detail=True, methods=['GET'], permission_classes=[IsOrgAdmin])
    def assets(self, request: Request, *args, **kwargs):
        """
        ### Retrieve Organization Assets

        This endpoint returns all assets associated with a specific organization.
        The assets listed here are restricted to those owned by the specified
        organization.

        Only the owner or administrators of the organization can access this endpoint.

        ### Additional Information
        For more details, please refer to `/api/v2/assets/`.
        """
        self.get_object()  # Call check permissions

        # Permissions check is done by `OrganizationAssetViewSet` permission classes
        asset_view = OrganizationAssetViewSet.as_view({'get': 'list'})
        django_http_request = request._request
        django_http_request.permissions_checked = True
        return asset_view(request=django_http_request)

    def get_queryset(self) -> QuerySet:
        user = get_database_user(self.request.user)
        return super().get_queryset().filter(users=user)

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
        >           "last_updated": {string (date), ISO format},
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
        response = Response(
            data=serializer.data,
            headers={
                'Date': http_date(serializer.calculator.get_last_updated().timestamp())
            },
        )

        return response

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
                {'error': 'There was a problem finding the organization.'},
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


class OrganizationMemberViewSet(viewsets.ModelViewSet):
    """
    * Manage organization members and their roles within an organization.
    * Run a partial update on an organization member to promote or demote.

    ## Organization Members API

    This API allows authorized users to view and manage the members of an
    organization, including their roles. It handles existing members. It also
    allows updating roles, such as promoting a member to an admin or assigning
    a new owner.

    ### List Members

    Retrieves all members in the specified organization.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/organizations/{organization_id}/members/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/organizations/org_12345/members/

    > Response 200

    >       {
    >           "count": 2,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                   "url": "http://[kpi]/api/v2/organizations/org_12345/ \
    >                   members/foo_bar/",
    >                   "user": "http://[kpi]/api/v2/users/foo_bar/",
    >                   "user__username": "foo_bar",
    >                   "user__email": "foo_bar@example.com",
    >                   "user__name": "Foo Bar",
    >                   "role": "owner",
    >                   "has_mfa_enabled": true,
    >                   "date_joined": "2024-08-11T12:36:32Z",
    >                   "is_active": true
    >               },
    >               {
    >                   "url": "http://[kpi]/api/v2/organizations/org_12345/ \
    >                   members/john_doe/",
    >                   "user": "http://[kpi]/api/v2/users/john_doe/",
    >                   "user__username": "john_doe",
    >                   "user__email": "john_doe@example.com",
    >                   "user__name": "John Doe",
    >                   "role": "admin",
    >                   "has_mfa_enabled": false,
    >                   "date_joined": "2024-10-21T06:38:45Z",
    >                   "is_active": true
    >               }
    >           ]
    >       }

    The response includes detailed information about each member, such as their
    username, email, role (owner, admin, member), and account status.

    ### Retrieve Member Details

    Retrieves the details of a specific member within an organization by username.

    <pre class="prettyprint">
    <b>GET</b> /api/v2/organizations/{organization_id}/members/{username}/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/organizations/org_12345/members/foo_bar/

    > Response 200

    >       {
    >           "url": "http://[kpi]/api/v2/organizations/org_12345/members/foo_bar/",
    >           "user": "http://[kpi]/api/v2/users/foo_bar/",
    >           "user__username": "foo_bar",
    >           "user__email": "foo_bar@example.com",
    >           "user__name": "Foo Bar",
    >           "role": "owner",
    >           "has_mfa_enabled": true,
    >           "date_joined": "2024-08-11T12:36:32Z",
    >           "is_active": true
    >       }

    ### Update Member Role

    Updates the role of a member within the organization to `owner`, `admin`, or
     `member`.

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/organizations/{organization_id}/members/{username}/
    </pre>

    #### Payload
    >       {
    >           "role": "admin"
    >       }

    - **admin**: Grants the member admin privileges within the organization
    - **member**: Revokes admin privileges, setting the member as a regular user

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/organizations/org_12345/ \
    >       members/demo_user/ -d '{"role": "admin"}'

    ### Remove Member

    Removes a member from the organization.

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/organizations/{organization_id}/members/{username}/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/organizations/org_12345/members/foo_bar/

    ## Permissions

    - The user must be authenticated to perform these actions.

    ## Notes

    - **Role Validation**: Only valid roles ('admin', 'member') are accepted
    in updates.
    """
    serializer_class = OrganizationUserSerializer
    permission_classes = [IsOrgOwnerOrAdminOrMember]
    pagination_class = OrganizationMemberPagination
    http_method_names = ['get', 'patch', 'delete']
    lookup_field = 'user__username'

    def get_queryset(self):
        organization_id = self.kwargs['organization_id']

        # Subquery to check if the user has an active MFA method
        mfa_subquery = MfaMethod.objects.filter(
            user=OuterRef('user_id'),
            is_active=True
        ).values('pk')

        # Subquery to check if the user is the owner
        owner_subquery = OrganizationOwner.objects.filter(
            organization_id=organization_id,
            organization_user=OuterRef('pk')
        ).values('pk')

        # Annotate with role based on organization ownership and admin status
        queryset = OrganizationUser.objects.filter(
            organization_id=organization_id
        ).annotate(
            role=Case(
                When(Exists(owner_subquery), then=Value('owner')),
                When(is_admin=True, then=Value('admin')),
                default=Value('member'),
                output_field=CharField()
            ),
            has_mfa_enabled=Exists(mfa_subquery)
        )
        return queryset
