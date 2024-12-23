from django.db.models import Case, CharField, OuterRef, QuerySet, Value, When
from django.db.models.expressions import Exists
from django.utils.http import http_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from kpi import filters
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.filters import AssetOrderingFilter, SearchFilter
from kpi.models.asset import Asset
from kpi.serializers.v2.service_usage import (
    CustomAssetUsageSerializer,
    ServiceUsageSerializer,
)
from kpi.utils.object_permission import get_database_user
from kpi.views.v2.asset import AssetViewSet
from ..accounts.mfa.models import MfaMethod
from .models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
    OrganizationInvitation
)
from .permissions import (
    HasOrgRolePermission,
    IsOrgAdminPermission,
    OrganizationNestedHasOrgRolePermission,
)
from .serializers import (
    OrganizationSerializer,
    OrganizationUserSerializer,
    OrgMembershipInviteSerializer
)


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

        organization = getattr(
            self.request, 'organization', self.request.user.organization
        )

        queryset = super().get_queryset(*args, **kwargs)
        if self.action == 'list':
            return queryset.filter(
                owner=organization.owner_user_object
            )
        else:
            raise NotImplementedError


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Organizations are groups of users with assigned permissions and configurations

    - Organization admins can manage the organization and its membership
    - Connect to authentication mechanisms and enforce policy
    - Create teams and projects under the organization
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    lookup_field = 'id'
    permission_classes = [HasOrgRolePermission]
    http_method_names = ['get', 'patch']

    @action(
        detail=True, methods=['GET'], permission_classes=[IsOrgAdminPermission]
    )
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

        # `get_object()` checks permissions
        organization = self.get_object()

        # Permissions check is done by `OrganizationAssetViewSet` permission classes
        asset_view = OrganizationAssetViewSet.as_view({'get': 'list'})
        django_http_request = request._request
        django_http_request.permissions_checked = True
        django_http_request.organization = organization
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
        >               "asr_seconds_current_period": {integer},
        >               "asr_seconds_all_time": {integer},
        >               "mt_characters_current_period": {integer},
        >               "mt_characters_all_time": {integer},
        >           },
        >           "total_storage_bytes": {integer},
        >           "total_submission_count": {
        >               "current_period": {integer},
        >               "all_time": {integer},
        >           },
        >           "current_period_start": {string (date), ISO format},
        >           "current_period_end": {string (date), ISO format}|{None},
        >           "last_updated": {string (date), ISO format},
        >       }
        ### CURRENT ENDPOINT
        """

        self.get_object()  # This call is necessary to check permissions
        serializer = ServiceUsageSerializer(
            get_database_user(request.user),
            context=self.get_serializer_context(),
        )

        response = Response(
            data=serializer.data,
            headers={
                'Date': http_date(serializer.calculator.get_last_updated().timestamp())
            },
        )

        return response

    @action(detail=True, methods=['get'], permission_classes=[IsOrgAdminPermission])
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
        >                   "nlp_usage_current_period": {
        >                       "total_asr_seconds": {integer},
        >                       "total_mt_characters": {integer},
        >                   }
        >                   "nlp_usage_all_time": {
        >                       "total_asr_seconds": {integer},
        >                       "total_mt_characters": {integer},
        >                   }
        >                   "storage_bytes": {integer},
        >                   "submission_count_current_period": {integer},
        >                   "submission_count_all_time": {integer},
        >                   "deployment_status": {string},
        >               },{...}
        >           ]
        >       }
        ### CURRENT ENDPOINT
        """

        # `get_object()` checks permissions
        organization = self.get_object()

        user_id = get_database_user(request.user).pk
        if organization.is_mmo:
            user_id = organization.owner_user_object.pk

        assets = (
            Asset.objects.only(
                'pk',
                'uid',
                '_deployment_status',
                'owner_id',
            )
            .select_related('owner')
            .filter(
                owner_id=user_id,
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
    The API uses `ModelViewSet` instead of `NestedViewSetMixin` to maintain
    explicit control over the queryset.

    ## Organization Members API

    This API allows authorized users to view and manage organization members and
    their roles, including promoting or demoting members (eg. to admin).

    * Manage members and their roles within an organization.
    * Update member roles (promote/demote).

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
    >                   "user__has_mfa_enabled": true,
    >                   "date_joined": "2024-08-11T12:36:32Z",
    >                   "user__is_active": true
    >               },
    >               {
    >                   "url": "http://[kpi]/api/v2/organizations/org_12345/ \
    >                   members/john_doe/",
    >                   "user": "http://[kpi]/api/v2/users/john_doe/",
    >                   "user__username": "john_doe",
    >                   "user__email": "john_doe@example.com",
    >                   "user__name": "John Doe",
    >                   "role": "admin",
    >                   "user__has_mfa_enabled": false,
    >                   "date_joined": "2024-10-21T06:38:45Z",
    >                   "user__is_active": true
    >               }
    >           ]
    >       }


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
    >           "user__has_mfa_enabled": true,
    >           "date_joined": "2024-08-11T12:36:32Z",
    >           "user__is_active": true
    >       }

    ### Update Member Role

    Updates the role of a member within the organization to `admin` or
     `member`.

    - **admin**: Grants the member admin privileges within the organization
    - **member**: Revokes admin privileges, setting the member as a regular user

    <pre class="prettyprint">
    <b>PATCH</b> /api/v2/organizations/{organization_id}/members/{username}/
    </pre>

    > Example
    >
    >       curl -X PATCH https://[kpi]/api/v2/organizations/org_12345/members/foo_bar/

    > Payload

    >       {
    >           "role": "admin"
    >       }

    > Response 200

    >       {
    >           "url": "http://[kpi]/api/v2/organizations/org_12345/members/foo_bar/",
    >           "user": "http://[kpi]/api/v2/users/foo_bar/",
    >           "user__username": "foo_bar",
    >           "user__email": "foo_bar@example.com",
    >           "user__name": "Foo Bar",
    >           "role": "admin",
    >           "user__has_mfa_enabled": true,
    >           "date_joined": "2024-08-11T12:36:32Z",
    >           "user__is_active": true
    >       }


    ### Remove Member

    Delete an organization member.

    <pre class="prettyprint">
    <b>DELETE</b> /api/v2/organizations/{organization_id}/members/{username}/
    </pre>

    > Example
    >
    >       curl -X DELETE https://[kpi]/api/v2/organizations/org_12345/members/foo_bar/

    ## Permissions

    - The user must be authenticated to perform these actions.
    - Owners and admins can manage members and roles.
    - Members can view the list but cannot update roles or delete members.

    ## Notes

    - **Role Validation**: Only valid roles ('admin', 'member') are accepted
    in updates.
    """
    serializer_class = OrganizationUserSerializer
    permission_classes = [OrganizationNestedHasOrgRolePermission]
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

        # Annotate with the role based on organization ownership and admin status
        queryset = OrganizationUser.objects.filter(
            organization_id=organization_id
        ).select_related('user__extra_details').annotate(
            role=Case(
                When(Exists(owner_subquery), then=Value('owner')),
                When(is_admin=True, then=Value('admin')),
                default=Value('member'),
                output_field=CharField()
            ),
            has_mfa_enabled=Exists(mfa_subquery)
        )
        return queryset


class OrgMembershipInviteViewSet(viewsets.ModelViewSet):
    """
    ### List Organization Invitation

    <pre class="prettyprint">
    <b>GET</b> /api/v2/organizations/{organization_id}/invites/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/organizations/org_12345/invites/

    > Response 200

    >       {
    >           "count": 2,
    >           "next": null,
    >           "previous": null,
    >           "results": [
    >               {
    >                   "url": "http://kf.kobo.local/api/v2/organizations/org3ua6H3F94CQpQEYs4RRz4/invites/f361ebf6-d1c1-4ced-8343-04b11863d784/",
    >                   "invited_by": "http://kf.kobo.local/api/v2/users/demo7/",
    >                   "status": "pending",
    >                   "created": "2024-12-11T16:00:00Z",
    >                   "modified": "2024-12-11T16:00:00Z",
    >                   "invitee": "raj_patel"
    >               },
    >               {
    >                   "url": "http://kf.kobo.local/api/v2/organizations/orgLRM8xmvWji4itYWWhLVgC/invites/1a8b93bf-eec5-4e56-bd4a-5f7657e6a2fd/",
    >                   "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >                   "status": "pending",
    >                   "created": "2024-12-11T18:19:56Z",
    >                   "modified": "2024-12-11T18:19:56Z",
    >                   "invitee": "demo7"
    >               },
    >           ]
    >       }

    ### Create Organization Invitation

    <pre class="prettyprint">
    <b>GET</b> /api/v2/organizations/{organization_id}/invites/
    </pre>

    > Example
    >
    >       curl -X GET https://[kpi]/api/v2/organizations/org_12345/invites/

    > Payload

    >       {
    >           "invitees": ["demo14", "demo13@demo13.com", "demo20@demo20.com"]
    >       }

    > Response 200

    >       [
    >           {
    >               "url": "http://kf.kobo.local/api/v2/organizations/orgLRM8xmvWji4itYWWhLVgC/invites/f3ba00b2-372b-4283-9d57-adbe7d5b1bf1/",
    >               "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >               "status": "pending",
    >               "created": "2024-12-20T13:35:13Z",
    >               "modified": "2024-12-20T13:35:13Z",
    >               "invitee": "demo14"
    >           },
    >           {
    >               "url": "http://kf.kobo.local/api/v2/organizations/orgLRM8xmvWji4itYWWhLVgC/invites/5e79e0b4-6de4-4901-bbe5-59807fcdd99a/",
    >               "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >               "status": "pending",
    >               "created": "2024-12-20T13:35:13Z",
    >               "modified": "2024-12-20T13:35:13Z",
    >               "invitee": "demo13"
    >           },
    >           {
    >               "url": "http://kf.kobo.local/api/v2/organizations/orgLRM8xmvWji4itYWWhLVgC/invites/3efb7217-171f-47a5-9a42-b23055e499d4/",
    >               "invited_by": "http://kf.kobo.local/api/v2/users/raj_patel/",
    >               "status": "pending",
    >               "created": "2024-12-20T13:35:13Z",
    >               "modified": "2024-12-20T13:35:13Z",
    >               "invitee": "demo20@demo20.com"
    >           }
    >       ]
    """
    serializer_class = OrgMembershipInviteSerializer
    permission_classes = []
    http_method_names = ['get', 'post', 'patch']
    lookup_field = 'guid'

    def get_queryset(self):
        return OrganizationInvitation.objects.select_related(
            'invitee', 'invited_by', 'organization'
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitations = serializer.save()

        # Return the serialized data for all created invitations
        serializer = OrgMembershipInviteSerializer(
            invitations, many=True, context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
