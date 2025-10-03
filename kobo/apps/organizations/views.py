from django.db import transaction
from django.db.models import Case, CharField, F, OuterRef, Q, QuerySet, Value, When
from django.db.models.expressions import Exists
from django.utils.http import http_date
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    extend_schema,
    extend_schema_view,
)
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from kpi import filters
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.filters import AssetOrderingFilter, SearchFilter
from kpi.models.asset import Asset
from kpi.schema_extensions.v2.invites.schema import (
    INVITE_ROLE_SCHEMA,
    INVITE_STATUS_SCHEMA,
)
from kpi.schema_extensions.v2.invites.serializers import (
    InviteCreatePayload,
    InviteCreateResponse,
    InvitePatchPayload,
    InviteResponse,
)
from kpi.schema_extensions.v2.members.serializers import (
    MemberListResponse,
    MemberPatchRequest,
)
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
from kpi.utils.schema_extensions.response import (
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)
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


@extend_schema(tags=['User / team / organization / usage'])
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
    lookup_url_kwarg = 'uid_organization'
    permission_classes = [HasOrgRolePermission]
    http_method_names = ['get', 'patch']

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
    tags=['User / team / organization / usage'],
    parameters=[
        OpenApiParameter(
            name='uid_organization',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the organization',
        )
    ],
)
@extend_schema_view(
    destroy=extend_schema(
        description=read_md('organizations', 'members/delete.md'),
        responses=open_api_204_empty_response(
            require_auth=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='user__username',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='Username of the user',
            )
        ],
    ),
    list=extend_schema(
        description=read_md('organizations', 'members/list.md'),
        responses=open_api_200_ok_response(
            MemberListResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('organizations', 'members/retrieve.md'),
        responses=open_api_200_ok_response(
            MemberListResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='user__username',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='Username of the user',
            )
        ],
    ),
    partial_update=extend_schema(
        description=read_md('organizations', 'members/update.md'),
        request={'application/json': MemberPatchRequest},
        responses=open_api_200_ok_response(
            MemberListResponse,
            require_auth=False,
        ),
        parameters=[
            OpenApiParameter(
                name='user__username',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='Username of the user',
            )
        ],
    ),
)
class OrganizationMemberViewSet(viewsets.ModelViewSet):
    """
    ## Organization Members API

    This API allows authorized users to view and manage organization members and
    their roles, including promoting or demoting members (eg. to admin).

    * Manage members and their roles within an organization.
    * Update member roles (promote/demote).

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
    parent_lookup_field = 'uid_organization'
    lookup_field = 'user__username'

    def paginate_queryset(self, queryset):
        page = super().paginate_queryset(queryset)
        members_user_ids = []
        organization_id = self.kwargs['uid_organization']

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
        organization_id = self.kwargs['uid_organization']

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
    tags=['User / team / organization / usage'],
    parameters=[
        OpenApiParameter(
            name='uid_organization',
            type=str,
            location=OpenApiParameter.PATH,
            required=True,
            description='UID of the organization asset',
        )
    ],
)
@extend_schema_view(
    create=extend_schema(
        description=read_md('organizations', 'invites/create.md'),
        request={'application/json': InviteCreatePayload},
        responses=open_api_201_created_response(
            InviteCreateResponse(many=False),
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    destroy=extend_schema(
        description=read_md('organizations', 'invites/delete.md'),
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
        ],
    ),
    list=extend_schema(
        description=read_md('organizations', 'invites/list.md'),
        responses=open_api_200_ok_response(
            InviteResponse,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    partial_update=extend_schema(
        description=read_md('organizations', 'invites/update.md'),
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
        ],
        examples=[
            OpenApiExample(
                name='Updating status',
                value={
                    'status': generate_example_from_schema(INVITE_STATUS_SCHEMA),
                },
                request_only=True,
            ),
            OpenApiExample(
                name='Updating role',
                value={
                    'role': generate_example_from_schema(INVITE_ROLE_SCHEMA),
                },
                request_only=True,
            ),
        ],
    ),
    retrieve=extend_schema(
        description=read_md('organizations', 'invites/retrieve.md'),
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
        ],
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
    parent_lookup_field = 'uid_organization'

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
        organization_id = self.kwargs['uid_organization']

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
