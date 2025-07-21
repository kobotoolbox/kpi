from django.db import transaction
from django.db.models import Case, CharField, F, OuterRef, Q, QuerySet, Value, When
from django.db.models.expressions import Exists
from django.utils.http import http_date
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.openapi import AutoSchema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.response import Response

from kpi import filters
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.filters import AssetOrderingFilter, SearchFilter
from kpi.models.asset import Asset
from kpi.schema_extensions.v2.invites.serializers import InviteResponse, \
    InviteCreatePayload, InvitePatchPayload
from kpi.schema_extensions.v2.organizations.serializers import (
    OrganizationAssetUsageResponse,
    OrganizationPatchPayload,
    OrganizationServiceUsageResponse,
)
from kpi.serializers.v2.asset import AssetSerializer
from kpi.serializers.v2.service_usage import (
    CustomAssetUsageSerializer,
    ServiceUsageSerializer,
)
from kpi.utils.object_permission import get_database_user
from kpi.utils.schema_extensions.examples import generate_example_from_schema
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import open_api_200_ok_response, \
    open_api_204_empty_response
from kpi.views.v2.asset import AssetViewSet
from ..accounts.mfa.models import MfaMethod
from .models import (
    Organization,
    OrganizationInvitation,
    OrganizationInviteStatusChoices,
    OrganizationOwner,
    OrganizationUser,
)
from .permissions import (
    HasOrgRolePermission,
    IsOrgAdminPermission,
    OrganizationNestedHasOrgRolePermission,
    OrgMembershipCreateOrDeleteInvitePermission,
    OrgMembershipInvitePermission,
)
from .serializers import (
    OrganizationSerializer,
    OrganizationUserSerializer,
    OrgMembershipInviteSerializer,
)
from .utils import revoke_org_asset_perms

class InviteSchema(AutoSchema):
    """
    Custom schema used to inject OpenAPI examples for OrgMembershipInviteViewSet
    at runtime.

    We cannot use `@extend_schema(..., examples=...)` or `@extend_schema_view(...)`
    directly for these examples because the values rely on variables
    that trigger Django's URL resolver via `reverse()`.
    Since those decorators are evaluated at module import time—before the full Django
    application and URL config are guaranteed to be loaded—this leads to circular
    import errors.

    By overriding `get_operation()` here, we defer the evaluation of those dynamic
    values until the OpenAPI schema is being generated (e.g., via `/api/v2/schema/`),
    when all apps and routes are fully initialized. This ensures a clean, safe injection
    of complex or reverse-dependent examples.
    """

    def get_operation(self, *args, **kwargs):

        from kpi.schema_extensions.v2.invites.schema import (
            INVITE_ROLE_SCHEMA,
            INVITE_STATUS_SCHEMA,
        )

        operation = super().get_operation(*args, **kwargs)

        if not operation:
            return None

        if operation.get('operationId') == 'api_v2_organizations_invites_partial_update':

            operation['requestBody']['content']['application/json']['examples'] = {
                'UsingStatus': {
                    'value': {
                        'status': generate_example_from_schema(INVITE_STATUS_SCHEMA),
                    },
                    'summary': 'Updating status',
                },
                'UsingRole': {
                    'value': {
                        'role': generate_example_from_schema(INVITE_ROLE_SCHEMA),
                    },
                    'summary': 'Updating role',
                },
            }

        return operation


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


@extend_schema(
    tags=['Organizations'],
)
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'organizations/org_list.md'),
        responses=open_api_200_ok_response(
            OrganizationSerializer,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'organizations/org_retrieve.md'),
        responses=open_api_200_ok_response(
            OrganizationSerializer,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'organizations/org_update.md'),
        request={'application/json': OrganizationPatchPayload},
        responses=open_api_200_ok_response(
            OrganizationSerializer,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    asset_usage=extend_schema(
        description=read_md('kpi', 'organizations/org_asset_usage.md'),
        responses=open_api_200_ok_response(
            OrganizationAssetUsageResponse(many=True),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    assets=extend_schema(
        description=read_md('kpi', 'organizations/org_assets.md'),
        responses=open_api_200_ok_response(
            AssetSerializer(many=True),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    service_usage=extend_schema(
        description=read_md('kpi', 'organizations/org_service_usage.md'),
        responses=open_api_200_ok_response(
            OrganizationServiceUsageResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
)
class OrganizationViewSet(viewsets.ModelViewSet):
    """
    Viewset for managing organizations

    Organizations are groups of users with assigned permissions and configurations

    - Organization admins can manage the organization and its membership
    - Connect to authentication mechanisms and enforce policy
    - Create teams and projects under the organization


    Available actions:
    - list              → GET       /api/v2/organizations/
    - retrieve          → GET       /api/v2/organizations/{id}/
    - partial_update    → PATCH     /api/v2/organizations/{id}/
    - asset_usage       → GET       /api/v2/organizations/{id}/asset_usage/
    - assets            → GET       /api/v2/organizations/{id}/assets/
    - service_usage     → PATCH     /api/v2/organizations/{id}/service_usage/

    Documentation:
    - docs/api/v2/organizations/org_list.md
    - docs/api/v2/organizations/org_retrieve.md
    - docs/api/v2/organizations/org_update.md
    - docs/api/v2/organizations/org_asset_usage.md
    - docs/api/v2/organizations/org_assets.md
    - docs/api/v2/organizations/org_service_usage.md
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    lookup_field = 'id'
    permission_classes = [HasOrgRolePermission]
    http_method_names = ['get', 'patch']
    renderer_classes = [
        JSONRenderer,
    ]

    @action(
        detail=True, methods=['GET'], permission_classes=[IsOrgAdminPermission]
    )
    def assets(self, request: Request, *args, **kwargs):

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


@extend_schema(
    tags=['members'],
)
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
    >                   "user__is_active": true,
    >                   "invite": {}
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
    >                   "user__is_active": true,
    >                   "invite": {
    >                       "url": "http://[kpi]/api/v2/organizations/org_12345/
    >                       invites/83c725f1-3f41-4f72-9657-9e6250e130e1/",
    >                       "invited_by": "http://[kpi]/api/v2/users/raj_patel/",
    >                       "status": "accepted",
    >                       "invitee_role": "admin",
    >                       "created": "2024-10-21T05:38:45Z",
    >                       "modified": "2024-10-21T05:40:45Z",
    >                       "invitee": "john_doe"
    >                   }
    >               },
    >               {
    >                   "url": null,
    >                   "user": null,
    >                   "user__username": null,
    >                   "user__email": "null,
    >                   "user__extra_details__name": "null,
    >                   "role": null,
    >                   "user__has_mfa_enabled": null,
    >                   "date_joined": null,
    >                   "user__is_active": null,
    >                   "invite": {
    >                       "url": "http://[kpi]/api/v2/organizations/org_12345/
    >                       invites/83c725f1-3f41-4f72-9657-9e6250e130e1/",
    >                       "invited_by": "http://[kpi]/api/v2/users/raj_patel/",
    >                       "status": "pending",
    >                       "invitee_role": "admin",
    >                       "created": "2025-01-07T09:03:50Z",
    >                       "modified": "2025-01-07T09:03:50Z",
    >                       "invitee": "demo"
    >                   }
    >               },
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

    def paginate_queryset(self, queryset):
        page = super().paginate_queryset(queryset)
        members_user_ids = []
        organization_id = self.kwargs['organization_id']

        for obj in page:
            if obj.model_type != '0_organization_user':
                break
            members_user_ids.append(obj.user_id)

        self._invites_queryset = OrganizationInvitation.objects.filter(  # noqa
            status=OrganizationInviteStatusChoices.ACCEPTED,
            invitee_id__in=members_user_ids,
            organization_id=organization_id,
        ).order_by('invitee_id', 'created')
        return page

    def get_queryset(self):
        organization_id = self.kwargs['organization_id']

        # Subquery to check if the user has an active MFA method
        mfa_subquery = MfaMethod.objects.filter(
            user=OuterRef('user_id'),
            is_active=True
        ).values('pk')

        # Subquery to check if the user is the owner
        owner_subquery = OrganizationOwner.objects.filter(
            organization_id=OuterRef('organization_id'),
            organization_user=OuterRef('pk')
        ).values('pk')

        # Annotate with the role based on organization ownership and admin status
        queryset = (
            OrganizationUser.objects.filter(organization_id=organization_id)
            .select_related('user__extra_details')
            .annotate(
                role=Case(
                    When(Exists(owner_subquery), then=Value('owner')),
                    When(is_admin=True, then=Value('admin')),
                    default=Value('member'),
                    output_field=CharField(),
                ),
                has_mfa_enabled=Exists(mfa_subquery),
                invite=Value(None, output_field=CharField()),
                ordering_date=F('created'),
                model_type=Value('0_organization_user', output_field=CharField()),
            )
        )

        if self.action == 'list':
            # Include invited users who are not yet part of this organization
            invitation_queryset = OrganizationInvitation.objects.filter(
                organization_id=organization_id,
                status__in=[
                    OrganizationInviteStatusChoices.PENDING,
                    OrganizationInviteStatusChoices.RESENT,
                ],
            )

            # Get existing user IDs from the queryset
            members_user_ids = queryset.values_list('user_id', flat=True)
            invitees = invitation_queryset.filter(
                Q(invitee_id__isnull=True) | ~Q(invitee_id__in=members_user_ids)
            ).annotate(
                ordering_date=F('created'),
                model_type=Value('1_organization_invitation', output_field=CharField()),
            )
            queryset = list(queryset) + list(invitees)
            queryset = sorted(queryset, key=lambda x: (x.model_type, x.ordering_date))

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if hasattr(self, '_invites_queryset'):
            invites_per_member = {}
            for invite in self._invites_queryset:
                invites_per_member[invite.invitee_id] = invite
            context['invites_per_member'] = invites_per_member

        return context

    def perform_destroy(self, instance):
        """
        Revoke asset permissions before deleting the user from the organization
        """
        member = instance
        with transaction.atomic():
            revoke_org_asset_perms(member.organization, [member.user_id])
            super().perform_destroy(member)


@extend_schema(
    tags=['Invites'],
    parameters=[
        OpenApiParameter(
            name='organization_id',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='ID of the organization asset',
        )
    ]
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('kpi', 'invites/create.md'),
        request={'application/json': InviteCreatePayload},
        responses=open_api_200_ok_response(
            InviteResponse(many=True),
            require_auth=False,
            raise_access_forbidden=False,
        )
    ),
    destroy=extend_schema(
        description=read_md('kpi', 'invites/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the invite',
            )
        ]
    ),
    list=extend_schema(
        description=read_md('kpi', 'invites/list.md'),
        responses=open_api_200_ok_response(
            InviteResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        )
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'invites/update.md'),
        request={'application/json': InvitePatchPayload},
        responses=open_api_200_ok_response(
            InviteResponse(many=False),
            require_auth=False,
        ),
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the invite',
            ),
        ]
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'invites/retrieve.md'),
        responses=open_api_200_ok_response(
            InviteResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the invite',
            ),
        ]
    ),
)
class OrgMembershipInviteViewSet(viewsets.ModelViewSet):
    """
    Viewset for managing organization invites

    Available actions:
    - create            → CREATE    /api/v2/organization/{parent_lookup_organization}/invites/  # noqa
    - destroy           → DELETE    /api/v2/organization/{parent_lookup_organization}/invites/{guid}/  # noqa
    - list              → LIST      /api/v2/organization/{parent_lookup_organization}/invites/  # noqa
    - retrieve          → RETRIEVE  /api/v2/organization/{parent_lookup_organization}/invites/{guid}/   # noqa
    - partial_update    → PATCH     /api/v2/organization/{parent_lookup_organization}/invites/{guid}/   # noqa

    Documentation:
    - docs/api/v2/invites/create.md
    - docs/api/v2/invites/destroy.md
    - docs/api/v2/invites/list.md
    - docs/api/v2/invites/retrieve.md
    - docs/api/v2/invites/update.md
    """

    serializer_class = OrgMembershipInviteSerializer
    http_method_names = ['get', 'post', 'patch', 'delete']
    lookup_field = 'guid'
    renderer_classes = (JSONRenderer,)
    schema = InviteSchema

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitations = serializer.save()

        # Return the serialized data for all created invites
        serializer = OrgMembershipInviteSerializer(
            invitations, many=True, context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        organization_id = self.kwargs['organization_id']

        query_filter = {'organization_id': organization_id}
        base_queryset = OrganizationInvitation.objects.select_related(
            'invitee', 'invited_by', 'organization'
        )
        queryset = base_queryset.filter(**query_filter)
        return queryset

    def get_permissions(self):
        if self.action in ['list', 'create', 'destroy']:
            return [OrgMembershipCreateOrDeleteInvitePermission()]

        return [OrgMembershipInvitePermission()]
