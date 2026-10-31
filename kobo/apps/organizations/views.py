import math
from datetime import timedelta
from operator import attrgetter

from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.core.exceptions import FieldError
from django.db import transaction
from django.db.models import Case, CharField, F, OuterRef, Q, QuerySet, Value, When
from django.db.models.expressions import Exists
from django.db.models.functions import Coalesce, Lower
from django.utils import timezone
from django.utils.http import http_date
from django.utils.translation import gettext_lazy as t
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from kpi import filters
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.exceptions import (
    QueryParserBadSyntax,
    QueryParserNotSupportedFieldLookup,
    RetryAfterAPIException,
    SearchQueryTooShortException,
)
from kpi.filters import AssetOrderingFilter, SearchFilter
from kpi.models.asset import Asset
from kpi.paginators import AssetPagination, NoCountPagination
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
    OrganizationPatchPayload,
    OrganizationServiceUsageResponse,
)
from kpi.serializers.v2.asset import (
    AssetListCountSerializer,
    AssetMinimalListSerializer,
    AssetSerializer,
)
from kpi.serializers.v2.service_usage import (
    CustomAssetUsageSerializer,
    ServiceUsageSerializer,
)
from kpi.utils.object_permission import get_database_user
from kpi.utils.placeholders import replace_placeholders
from kpi.utils.query_parser import ParseError, parse
from kpi.utils.schema_extensions.examples import generate_example_from_schema
from kpi.utils.schema_extensions.markdown import read_md
from kpi.utils.schema_extensions.response import (
    ErrorDetailSerializer,
    open_api_200_ok_response,
    open_api_201_created_response,
    open_api_204_empty_response,
)
from kpi.views.v2.asset import AssetViewSet
from .constants import (
    CANNOT_REMOVE_OWNER_ERROR,
    INVITE_ALREADY_ACCEPTED_ERROR,
    INVITE_CANNOT_BE_RESENT_ERROR,
    INVITE_RESENT_TOO_QUICKLY_ERROR,
    PENDING_TRANSFER_MEMBER_REMOVAL_ERROR,
    TRANSFER_NOT_PENDING_ERROR,
)
from .exceptions import InvalidMembershipRequest
from ..accounts.mfa.utils import mfa_is_active_expression
from .models import (
    Organization,
    OrganizationInvitation,
    OrganizationInviteStatusChoices,
    OrganizationOwner,
    OrganizationOwnershipTransfer,
    OrganizationUser,
)
from .permissions import (
    HasOrgRolePermission,
    IsOrgAdminPermission,
    OrganizationNestedHasOrgRolePermission,
    OrganizationOwnershipTransferPermission,
    OrgMembershipCreateOrDeleteInvitePermission,
    OrgMembershipInvitePermission,
)
from .serializers import (
    OrganizationOwnershipTransferSerializer,
    OrganizationResponseSerializer,
    OrganizationSerializer,
    OrganizationUserSerializer,
    OrgMembershipInviteSerializer,
)
from .utils import revoke_org_asset_perms

ROLE_RANKS = {'member': 1, 'admin': 2, 'owner': 3}


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

    def get_serializer_context(self):
        """
        Injects `user_is_org_admin` into the serializer context once per
        request. Org admins have no explicit ObjectPermission records, so the
        serializer cannot detect their implicit `manage_asset` grant by scanning
        DB assignments alone. This flag lets `AssetListSerializer` grant them
        full permission visibility without issuing per-asset queries.
        `is_admin_only()` is decorated with `@cache_for_request`, so it only
        hits the DB once regardless of page size.
        """
        context = super().get_serializer_context()
        organization = getattr(self.request, 'organization', None)
        if organization:
            context['user_is_org_admin'] = organization.is_admin_only(self.request.user)
        return context

    def get_queryset(self, *args, **kwargs):
        if not getattr(self.request, 'permissions_checked', False):
            # Perform a sanity check to ensure that permissions have been properly
            # validated within `OrganizationViewSet.assets()`.
            raise AttributeError('`permissions_checked` is missing')

        organization = getattr(
            self.request, 'organization', self.request.user.organization
        )

        queryset = super().get_queryset(*args, **kwargs)
        return queryset.filter(owner=organization.owner_user_object)


@extend_schema(tags=['User / team / organization / usage'])
@extend_schema_view(
    list=extend_schema(
        description=read_md('kpi', 'organizations/org_list.md'),
        responses=open_api_200_ok_response(
            OrganizationResponseSerializer,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    retrieve=extend_schema(
        description=read_md('kpi', 'organizations/org_retrieve.md'),
        responses=open_api_200_ok_response(
            OrganizationResponseSerializer,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    partial_update=extend_schema(
        description=read_md('kpi', 'organizations/org_update.md'),
        request={'application/json': OrganizationPatchPayload},
        responses=open_api_200_ok_response(
            OrganizationResponseSerializer,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    asset_usage=extend_schema(
        description=read_md('kpi', 'organizations/org_asset_usage.md'),
        responses=open_api_200_ok_response(
            CustomAssetUsageSerializer(many=True),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='q',
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description=t('Filter the results with search query'),
            ),
            OpenApiParameter(
                name='start',
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description=t('Paginate results with start parameter'),
            ),
            OpenApiParameter(
                name='limit',
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description=t('Paginate results with limit parameter'),
            ),
            OpenApiParameter(
                name='ordering',
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description=t('Which field to use when ordering the results.'),
            ),
        ],
        operation_id='api_v2_organizations_asset_usage_list',
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
    asset_counts=extend_schema(
        description=read_md('kpi', 'organizations/org_asset_counts.md'),
        responses=open_api_200_ok_response(
            AssetListCountSerializer,
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
    ),
    asset_minimal_list=extend_schema(
        description=read_md('kpi', 'organizations/org_asset_minimal_list.md'),
        responses=open_api_200_ok_response(
            AssetMinimalListSerializer(many=True),
            require_auth=False,
            raise_access_forbidden=False,
            validate_payload=False,
        ),
        parameters=[
            OpenApiParameter(
                name='q',
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description=t('Filter the results with search query'),
            ),
            OpenApiParameter(
                name='limit',
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description=t('Number of results to return per page.'),
            ),
            OpenApiParameter(
                name='start',
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description=t('The initial index from which to return the results.'),
            ),
        ],
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
    - retrieve          → GET       /api/v2/organizations/{uid_organization}/
    - partial_update    → PATCH     /api/v2/organizations/{uid_organization}/
    - asset_usage       → GET       /api/v2/organizations/{uid_organization}/asset_usage/
    - assets            → GET       /api/v2/organizations/{uid_organization}/assets/
    - asset-counts      → GET       /api/v2/organizations/{uid_organization}/assets/counts/  # noqa
    - service_usage     → PATCH     /api/v2/organizations/{uid_organization}/service_usage/

    Documentation:
    - docs/api/v2/organizations/org_list.md
    - docs/api/v2/organizations/org_retrieve.md
    - docs/api/v2/organizations/org_update.md
    - docs/api/v2/organizations/org_asset_usage.md
    - docs/api/v2/organizations/org_asset_counts.md
    - docs/api/v2/organizations/org_asset_minimal_list.md
    - docs/api/v2/organizations/org_assets.md
    - docs/api/v2/organizations/org_service_usage.md
    """

    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    lookup_field = 'id'
    lookup_url_kwarg = 'uid_organization'
    permission_classes = [HasOrgRolePermission]
    http_method_names = ['get', 'patch']
    # Bare `q` terms search project names (see SearchFilter)
    search_default_field_lookups = ['name__icontains']

    @action(
        detail=True,
        methods=['GET'],
        permission_classes=[IsOrgAdminPermission],
        pagination_class=AssetPagination,
    )
    def assets(self, request: Request, *args, **kwargs):

        # `get_object()` checks permissions
        organization = self.get_object()

        asset_view = OrganizationAssetViewSet.as_view({'get': 'list'})
        django_http_request = request._request
        # OrganizationAssetViewSet relies on permissions_checked rather than its own
        # permission classes, so set that here
        django_http_request.permissions_checked = True
        django_http_request.organization = organization
        return asset_view(request=django_http_request)

    @action(
        detail=True,
        methods=['GET'],
        permission_classes=[IsOrgAdminPermission],
        url_path='assets/counts',
    )
    def asset_counts(self, request: Request, *args, **kwargs):
        organization = self.get_object()
        asset_view = OrganizationAssetViewSet.as_view({'get': 'counts'})
        django_http_request = request._request
        django_http_request.permissions_checked = True
        django_http_request.organization = organization
        return asset_view(request=django_http_request)

    @action(
        detail=True,
        methods=['GET'],
        permission_classes=[IsOrgAdminPermission],
        url_path='assets/minimal-list',
    )
    def asset_minimal_list(self, request: Request, *args, **kwargs):
        organization = self.get_object()
        asset_view = OrganizationAssetViewSet.as_view(
            {'get': 'minimal_list'}, pagination_class=NoCountPagination
        )
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

        filtered_assets = SearchFilter().filter_queryset(request, assets, self)
        filtered_assets = filters.AssetOrganizationUsageFilter().filter_queryset(
            request, filtered_assets, self
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
                name='username',
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
        parameters=[
            OpenApiParameter(
                name='q',
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Filter the results with a search query.',
            ),
            OpenApiParameter(
                name='ordering',
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=[
                    'user__username',
                    '-user__username',
                    'status',
                    '-status',
                    'date_joined',
                    '-date_joined',
                    'date_added',
                    '-date_added',
                    'created',
                    '-created',
                    'role',
                    '-role',
                    'user__has_sso_enabled',
                    '-user__has_sso_enabled',
                ],
                description=(
                    'Which field to use when ordering the results. '
                    'Note: `role` sorts by privilege rank '
                    '(`member` → `admin` → `owner`).'
                ),
            ),
        ],
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
                name='username',
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
                name='username',
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
    lookup_url_kwarg = 'username'

    def paginate_queryset(self, queryset):
        page = super().paginate_queryset(queryset)
        members_user_ids = []
        organization_id = self.kwargs['uid_organization']

        for obj in page:
            if obj.model_type == '0_organization_user':
                members_user_ids.append(obj.user_id)

        self._invites_queryset = OrganizationInvitation.objects.filter(  # noqa
            status=OrganizationInviteStatusChoices.ACCEPTED,
            invitee_id__in=members_user_ids,
            organization_id=organization_id,
        ).order_by('invitee_id', 'created')
        self._pending_transfers_queryset = OrganizationOwnershipTransfer.objects.filter(
            status=OrganizationInviteStatusChoices.PENDING,
            recipient_id__in=members_user_ids,
            organization_id=organization_id,
        ).select_related('sender__extra_details', 'recipient', 'organization')
        return page

    def get_queryset(self):
        organization_id = self.kwargs['uid_organization']

        # Subquery to check if the user has an associated SSO account
        sso_subquery = SocialAccount.objects.filter(user=OuterRef('user_id')).values(
            'pk'
        )

        # Subquery to check if the user is the owner
        owner_subquery = OrganizationOwner.objects.filter(
            organization_id=OuterRef('organization_id'),
            organization_user=OuterRef('pk')
        ).values('pk')

        role_annotation = Case(
            When(Exists(owner_subquery), then=Value('owner')),
            When(is_admin=True, then=Value('admin')),
            default=Value('member'),
            output_field=CharField(),
        )

        # Annotate with the role based on organization ownership and admin status
        queryset = (
            OrganizationUser.objects.filter(
                organization_id=organization_id, user__is_active=True
            )
            .select_related('user__extra_details')
            .annotate(
                role=role_annotation,
                has_mfa_enabled=mfa_is_active_expression('user_id'),
                has_sso_enabled=Exists(sso_subquery),
                invite=Value(None, output_field=CharField()),
                ordering_date=F('created'),
                model_type=Value('0_organization_user', output_field=CharField()),
                username_sort=Lower(F('user__username')),
                status_sort=Value('active'),
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

            # Get ALL existing user IDs from the base queryset BEFORE applying the `q`
            # filter. This ensures we don't accidentally include pending invitations
            # for existing members just because their member profile was filtered out
            # by `q`.
            members_user_ids = queryset.values_list('user_id', flat=True)

            q = self.request.query_params.get('q', '').strip()
            if q:
                user_allowed_fields = {
                    'organizations.organizationuser': frozenset({'user'}),
                    'kobo_auth.user': frozenset(
                        {'username', 'email', 'first_name', 'last_name'}
                    ),
                }
                invite_allowed_fields = {
                    'organizations.organizationinvitation': frozenset(
                        {'invitee', 'invitee_identifier'}
                    ),
                    'kobo_auth.user': frozenset(
                        {'username', 'email', 'first_name', 'last_name'}
                    ),
                }

                user_invalid_exception = None
                try:
                    q_obj_user = parse(
                        q,
                        default_field_lookups=[
                            'user__username__icontains',
                            'user__email__icontains',
                            'user__first_name__icontains',
                            'user__last_name__icontains',
                            'user__extra_details__data__name__icontains',
                        ],
                        model=queryset.model,
                        allowed_lookup_fields=user_allowed_fields,
                        user=self.request.user,
                    )

                    queryset = queryset.filter(q_obj_user)
                except QueryParserNotSupportedFieldLookup as e:
                    user_invalid_exception = e
                    queryset = queryset.none()
                except (FieldError, ValueError) as e:
                    user_invalid_exception = e
                    queryset = queryset.none()
                except (
                    ParseError,
                    QueryParserBadSyntax,
                    SearchQueryTooShortException,
                ) as e:
                    raise e

                invite_invalid_exception = None
                try:
                    q_obj_invite = parse(
                        q,
                        default_field_lookups=[
                            'invitee__username__icontains',
                            'invitee__email__icontains',
                            'invitee__first_name__icontains',
                            'invitee__last_name__icontains',
                            'invitee__extra_details__data__name__icontains',
                            'invitee_identifier__icontains',
                        ],
                        model=invitation_queryset.model,
                        allowed_lookup_fields=invite_allowed_fields,
                        user=self.request.user,
                    )
                    invitation_queryset = invitation_queryset.filter(q_obj_invite)
                except QueryParserNotSupportedFieldLookup as e:
                    invite_invalid_exception = e
                    invitation_queryset = invitation_queryset.none()
                except (FieldError, ValueError) as e:
                    invite_invalid_exception = e
                    invitation_queryset = invitation_queryset.none()
                except (
                    ParseError,
                    QueryParserBadSyntax,
                    SearchQueryTooShortException,
                ) as e:
                    raise e

                if (
                    user_invalid_exception is not None
                    and invite_invalid_exception is not None
                ):
                    if isinstance(
                        user_invalid_exception, QueryParserNotSupportedFieldLookup
                    ):
                        raise user_invalid_exception
                    elif isinstance(
                        invite_invalid_exception, QueryParserNotSupportedFieldLookup
                    ):
                        raise invite_invalid_exception
                    else:
                        raise QueryParserNotSupportedFieldLookup()

            invitees = invitation_queryset.filter(
                Q(invitee_id__isnull=True) | ~Q(invitee_id__in=members_user_ids)
            ).annotate(
                role=Lower(F('invitee_role')),
                has_sso_enabled=Value(False),
                ordering_date=F('created'),
                model_type=Value('1_organization_invitation', output_field=CharField()),
                username_sort=Lower(
                    Coalesce(F('invitee__username'), F('invitee_identifier'), Value(''))
                ),
                status_sort=Value('invited'),
            )
            queryset = list(queryset) + list(invitees)

            for row in queryset:
                row.role_sort = ROLE_RANKS.get(row.role, 0)

            SORT_FIELDS = {
                'user__username': 'username_sort',
                'status': 'status_sort',
                'date_joined': 'ordering_date',
                'date_added': 'ordering_date',
                'created': 'ordering_date',
                'role': 'role_sort',
                'user__has_sso_enabled': 'has_sso_enabled',
            }

            ordering = self.request.query_params.get('ordering', '').strip()
            reverse = ordering.startswith('-')
            field_name = ordering.lstrip('-')

            if sort_attr := SORT_FIELDS.get(field_name):
                queryset = sorted(
                    queryset,
                    key=attrgetter(sort_attr, 'model_type', 'ordering_date'),
                    reverse=reverse,
                )
            else:
                queryset = sorted(
                    queryset, key=attrgetter('model_type', 'ordering_date')
                )

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()

        if hasattr(self, '_invites_queryset'):
            invites_per_member = {}
            for invite in self._invites_queryset:
                invites_per_member[invite.invitee_id] = invite
            context['invites_per_member'] = invites_per_member

        if hasattr(self, '_pending_transfers_queryset'):
            pending_transfers_per_member = {}
            for transfer in self._pending_transfers_queryset:
                pending_transfers_per_member[transfer.recipient_id] = transfer
            context['pending_transfers_per_member'] = pending_transfers_per_member

        return context

    def perform_destroy(self, instance):
        """
        Revoke asset permissions before deleting the user from the organization
        """
        with transaction.atomic():
            try:
                member = (
                    OrganizationUser.objects.select_for_update()
                    .select_related('organization', 'user')
                    .get(pk=instance.pk)
                )
            except OrganizationUser.DoesNotExist:
                return

            if member.organization.is_owner(member.user):
                raise InvalidMembershipRequest(CANNOT_REMOVE_OWNER_ERROR)

            if OrganizationOwnershipTransfer.objects.filter(
                organization=member.organization,
                recipient=member.user,
                status=OrganizationInviteStatusChoices.PENDING,
            ).exists():
                raise InvalidMembershipRequest(PENDING_TRANSFER_MEMBER_REMOVAL_ERROR)

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
    - create            → CREATE    /api/v2/organization/{uid_organization}/invites/  # noqa
    - destroy           → DELETE    /api/v2/organization/{uid_organization}/invites/{guid}/  # noqa
    - list              → LIST      /api/v2/organization/{uid_organization}/invites/  # noqa
    - retrieve          → RETRIEVE  /api/v2/organization/{uid_organization}/invites/{guid}/   # noqa
    - partial_update    → PATCH     /api/v2/organization/{uid_organization}/invites/{guid}/   # noqa

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
    create=extend_schema(
        description='Initiate an organization ownership transfer request (outgoing owner only).',
        responses=open_api_201_created_response(
            OrganizationOwnershipTransferSerializer,
            require_auth=False,
            raise_access_forbidden=False,
        ),
    ),
    retrieve=extend_schema(
        description='Retrieve an organization ownership transfer by GUID.',
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the ownership transfer',
            )
        ],
    ),
    list=extend_schema(
        description='List organization ownership transfers for the current user.',
        parameters=[
            OpenApiParameter(
                name='status',
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Filter ownership transfers by status (e.g. pending, accepted).',
            )
        ],
    ),
)
class OrganizationOwnershipTransferViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet for managing organization ownership transfers.

    Available actions:
    - create   → POST  /api/v2/organizations/{uid_organization}/ownership-transfers/
    - list     → GET   /api/v2/organizations/{uid_organization}/ownership-transfers/
    - retrieve → GET   /api/v2/organizations/{uid_organization}/ownership-transfers/{guid}/
    - accept   → PATCH /api/v2/organizations/{uid_organization}/ownership-transfers/{guid}/accept/
    - decline  → PATCH /api/v2/organizations/{uid_organization}/ownership-transfers/{guid}/decline/
    - cancel   → PATCH /api/v2/organizations/{uid_organization}/ownership-transfers/{guid}/cancel/
    - resend   → POST  /api/v2/organizations/{uid_organization}/ownership-transfers/{guid}/resend/
    """

    serializer_class = OrganizationOwnershipTransferSerializer
    permission_classes = [OrganizationOwnershipTransferPermission]
    http_method_names = ['get', 'post', 'patch']
    parent_lookup_field = 'uid_organization'
    lookup_field = 'guid'

    def get_queryset(self):
        organization_id = self.kwargs.get(self.parent_lookup_field)
        user = get_database_user(self.request.user)
        queryset = OrganizationOwnershipTransfer.objects.filter(
            organization_id=organization_id
        ).select_related(
            'sender__extra_details', 'recipient', 'organization'
        )

        if self.action == 'list':
            queryset = queryset.filter(Q(sender=user) | Q(recipient=user))
            status_param = self.request.query_params.get('status')
            if status_param:
                queryset = queryset.filter(status=status_param.lower())

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transfer = serializer.save()
        response_serializer = self.get_serializer(transfer)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        description='Accept an organization ownership transfer request (invitee only).',
        request=None,
        responses={
            **open_api_200_ok_response(
                OrganizationOwnershipTransferSerializer,
                validate_payload=False,
            ),
            (status.HTTP_400_BAD_REQUEST, 'application/json'): OpenApiResponse(
                response=ErrorDetailSerializer,
                examples=[
                    OpenApiExample(
                        name='Bad Request',
                        value={'detail': 'Transfer is not pending.'},
                        response_only=True,
                    )
                ],
            ),
        },
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the ownership transfer',
            ),
        ],
    )
    @action(detail=True, methods=['patch'])
    def accept(self, request, *args, **kwargs):
        transfer = self.get_object()

        with transaction.atomic():
            locked_transfer = (
                OrganizationOwnershipTransfer.objects.select_for_update().get(
                    pk=transfer.pk
                )
            )
            if locked_transfer.status != OrganizationInviteStatusChoices.PENDING:
                if locked_transfer.status == OrganizationInviteStatusChoices.ACCEPTED:
                    raise serializers.ValidationError(
                        {'detail': INVITE_ALREADY_ACCEPTED_ERROR}
                    )
                raise serializers.ValidationError(
                    {'detail': TRANSFER_NOT_PENDING_ERROR}
                )

            locked_transfer.status = OrganizationInviteStatusChoices.ACCEPTED
            locked_transfer.save(update_fields=['status', 'modified'])
            # Placeholder for async ownership and asset reassignment task (DEV-2896)

        transfer.status = locked_transfer.status
        transfer.modified = locked_transfer.modified
        transfer.send_acceptance_email()
        return Response(self.get_serializer(transfer).data, status=status.HTTP_200_OK)

    @extend_schema(
        description='Decline an organization ownership transfer request (invitee only).',
        request=None,
        responses={
            **open_api_200_ok_response(
                OrganizationOwnershipTransferSerializer,
                validate_payload=False,
            ),
            (status.HTTP_400_BAD_REQUEST, 'application/json'): OpenApiResponse(
                response=ErrorDetailSerializer,
                examples=[
                    OpenApiExample(
                        name='Bad Request',
                        value={'detail': 'Transfer is not pending.'},
                        response_only=True,
                    )
                ],
            ),
        },
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the ownership transfer',
            ),
        ],
    )
    @action(detail=True, methods=['patch'])
    def decline(self, request, *args, **kwargs):
        transfer = self.get_object()

        with transaction.atomic():
            locked_transfer = (
                OrganizationOwnershipTransfer.objects.select_for_update().get(
                    pk=transfer.pk
                )
            )
            if locked_transfer.status != OrganizationInviteStatusChoices.PENDING:
                raise serializers.ValidationError(
                    {'detail': TRANSFER_NOT_PENDING_ERROR}
                )

            locked_transfer.status = OrganizationInviteStatusChoices.DECLINED
            locked_transfer.save(update_fields=['status', 'modified'])

        transfer.status = locked_transfer.status
        transfer.modified = locked_transfer.modified
        transfer.send_refusal_email()
        return Response(self.get_serializer(transfer).data, status=status.HTTP_200_OK)

    @extend_schema(
        description='Cancel a pending organization ownership transfer request (outgoing owner only).',
        request=None,
        responses={
            **open_api_200_ok_response(
                OrganizationOwnershipTransferSerializer,
                validate_payload=False,
            ),
            (status.HTTP_400_BAD_REQUEST, 'application/json'): OpenApiResponse(
                response=ErrorDetailSerializer,
                examples=[
                    OpenApiExample(
                        name='Bad Request',
                        value={'detail': 'Transfer is not pending.'},
                        response_only=True,
                    )
                ],
            ),
        },
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the ownership transfer',
            ),
        ],
    )
    @action(detail=True, methods=['patch'])
    def cancel(self, request, *args, **kwargs):
        transfer = self.get_object()

        with transaction.atomic():
            locked_transfer = (
                OrganizationOwnershipTransfer.objects.select_for_update().get(
                    pk=transfer.pk
                )
            )
            if locked_transfer.status != OrganizationInviteStatusChoices.PENDING:
                raise serializers.ValidationError(
                    {'detail': TRANSFER_NOT_PENDING_ERROR}
                )

            locked_transfer.status = OrganizationInviteStatusChoices.CANCELLED
            locked_transfer.save(update_fields=['status', 'modified'])

        transfer.status = locked_transfer.status
        transfer.modified = locked_transfer.modified
        transfer.send_cancellation_email()
        return Response(self.get_serializer(transfer).data, status=status.HTTP_200_OK)

    @extend_schema(
        description='Resend the invitation email for a pending organization ownership transfer (outgoing owner only).',
        request=None,
        responses={
            **open_api_200_ok_response(
                OrganizationOwnershipTransferSerializer,
                validate_payload=False,
                raise_throttled=True,
            ),
            (status.HTTP_400_BAD_REQUEST, 'application/json'): OpenApiResponse(
                response=ErrorDetailSerializer,
                examples=[
                    OpenApiExample(
                        name='Bad Request',
                        value={'detail': 'Invitation cannot be resent.'},
                        response_only=True,
                    )
                ],
            ),
        },
        parameters=[
            OpenApiParameter(
                name='guid',
                type=str,
                location=OpenApiParameter.PATH,
                required=True,
                description='GUID of the ownership transfer',
            ),
        ],
    )
    @action(detail=True, methods=['post'])
    def resend(self, request, *args, **kwargs):
        transfer = self.get_object()

        with transaction.atomic():
            locked_transfer = (
                OrganizationOwnershipTransfer.objects.select_for_update().get(
                    pk=transfer.pk
                )
            )
            if locked_transfer.status != OrganizationInviteStatusChoices.PENDING:
                raise serializers.ValidationError(
                    {'detail': INVITE_CANNOT_BE_RESENT_ERROR}
                )

            retry_after = locked_transfer.modified + timedelta(
                seconds=settings.ORG_INVITATION_RESENT_RESET_AFTER
            )
            now = timezone.now()
            if retry_after > now:
                remaining_delta = retry_after - now
                remaining_seconds = int(remaining_delta.total_seconds())
                raise RetryAfterAPIException(
                    replace_placeholders(
                        INVITE_RESENT_TOO_QUICKLY_ERROR,
                        minutes=str(math.ceil(remaining_seconds / 60)),
                    ),
                    retry_after=remaining_seconds,
                )

            locked_transfer.modified = now
            locked_transfer.save(update_fields=['modified'])

        transfer.modified = locked_transfer.modified
        transfer.send_invite_email()
        return Response(self.get_serializer(transfer).data, status=status.HTTP_200_OK)
