import re
import json

from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.db import IntegrityError, transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.authentication import IsAuthenticatedIdP, ScimAuthentication
from kobo.apps.kobo_scim.models import ScimGroup
from kobo.apps.kobo_scim.pagination import ScimPagination
from kobo.apps.kobo_scim.renderers import SCIMParser, SCIMRenderer
from kobo.apps.kobo_scim.schema_extensions.v2.generic.serializers import (
    ScimErrorSerializer,
)
from kobo.apps.kobo_scim.serializers import ScimGroupSerializer, ScimUserSerializer


def normalize_scim_patch_operations(operations):
    """
    Normalizes SCIM PATCH operations. scim-for-keycloak sends the `value` payload as an
    escaped stringified JSON block instead of a native dictionary when `path` is
    omitted.
    """
    if not isinstance(operations, list):
        return []

    normalized = []
    for op in operations:
        new_op = dict(op)
        value = new_op.get('value')

        if isinstance(value, str):
            try:
                # If it's a stringified JSON blob, attempt to parse it
                new_op['value'] = json.loads(value)
            except json.JSONDecodeError:
                pass

        normalized.append(new_op)

    return normalized

def scim_responses(success_map):
    responses = {
        401: ScimErrorSerializer,
        403: ScimErrorSerializer,
    }
    if success_map:
        responses.update(success_map)
    return responses


def scim_extend_schema(**kwargs):
    """
    Applies common SCIM OpenAPI parameters (e.g. idp_slug) to viewsets/views.
    """
    defaults = {
        'tags': ['SCIM'],
        'parameters': [
            OpenApiParameter('idp_slug', OpenApiTypes.STR, OpenApiParameter.PATH)
        ],
    }
    defaults.update(kwargs)
    return extend_schema(**defaults)


@scim_extend_schema()
@extend_schema_view(
    list=extend_schema(
        description='Returns a list of SCIM users matching the optional query',
        responses=scim_responses({200: ScimUserSerializer(many=True)}),
    ),
    retrieve=extend_schema(
        description='Returns a specific SCIM user.',
        responses=scim_responses({200: ScimUserSerializer}),
    ),
    destroy=extend_schema(
        description="Deactivates all Kobo accounts linked to the user's "
        + 'email address.',
        responses=scim_responses({204: None}),
    ),
    partial_update=extend_schema(
        description='Updates a SCIM user. Currently only supports '
        'deactivation via the `active` attribute.',
        responses=scim_responses({200: ScimUserSerializer}),
    ),
)
class ScimUserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    SCIM 2.0 compliant Users API endpoint.
    - GET /Users
    - GET /Users/{user_id}
    """

    queryset = User.objects.all().order_by('id')
    serializer_class = ScimUserSerializer
    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    pagination_class = ScimPagination
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer]

    @extend_schema(
        responses=scim_responses(
            {
                201: ScimUserSerializer,
                409: OpenApiTypes.OBJECT,
                400: OpenApiTypes.OBJECT,
            }
        )
    )
    def create(self, request, *args, **kwargs):
        """
        Handle POST requests (user provisioning from IdP).
        """
        idp = request.auth
        if not idp or not idp.social_app:
            return Response(
                {'detail': 'IdP not configured for user provisioning'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data
        username = data.get('userName')

        # SCIM can send multiple emails; we try to grab the first one
        emails = data.get('emails', [])
        email = ''
        if emails and isinstance(emails, list):
            # Prefer 'primary' -> then 'work' -> then the first available
            for e in emails:
                if e.get('primary'):
                    email = e.get('value', '')
                    break
            if not email:
                email = emails[0].get('value', '')

        if not username:
            return Response(
                {'detail': 'userName is required'}, status=status.HTTP_400_BAD_REQUEST
            )

        # If no explicit email was provided but userName looks like an email, use it
        if not email and '@' in username:
            email = username

        name_dict = data.get('name', {})
        first_name = name_dict.get('givenName', '')
        last_name = name_dict.get('familyName', '')
        uid = data.get('externalId') or username

        try:
            with transaction.atomic():
                # First, check if user exists via SocialAccount linkage
                social_account = (
                    SocialAccount.objects.filter(
                        provider=idp.social_app.provider_id, uid=uid
                    )
                    .select_related('user')
                    .first()
                )

                user = social_account.user if social_account else None

                # Fallback to username/email matching if not linked yet
                if not user:
                    user_by_username = User.objects.filter(
                        username__iexact=username
                    ).first()
                    user_by_email = (
                        User.objects.filter(email__iexact=email).first()
                        if email
                        else None
                    )
                    user = user_by_username or user_by_email

                if not user:
                    # Create the user natively
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        first_name=first_name,
                        last_name=last_name,
                        is_active=data.get('active', True),
                    )
                else:
                    # If they exist, optionally reactivate them if the IdP sends
                    # active=True. (A deprovisioned user in Kobo is not deleted
                    # but deactivated).
                    if not user.is_active and data.get('active', True):
                        user.is_active = True
                        user.save(update_fields=['is_active'])

                # Ensure the SocialAccount link exists so SSO works flawlessly.
                # We catch IntegrityError here just in case another IdP already
                # has this exact uid linked.
                SocialAccount.objects.get_or_create(
                    user=user, provider=idp.social_app.provider_id, uid=uid
                )

                serializer = self.get_serializer(user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except IntegrityError:
            # This is a safe fallback for edge cases like duplicate SocialAccount UIDs
            return Response(
                {
                    'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                    'detail': 'One or more attributes in the resource already exists.',
                    'status': '409',
                },
                status=status.HTTP_409_CONFLICT,
            )

    @extend_schema(
        responses=scim_responses(
            {
                200: ScimUserSerializer,
                409: OpenApiTypes.OBJECT,
            }
        )
    )
    def update(self, request, *args, **kwargs):
        """
        Handle PUT requests (user update from IdP).
        Authentik can send a PUT request to update a user's details. If it tries to
        update a user to have a username or email that already exists on another
        account, we intercept the IntegrityError and return a SCIM 409 Conflict.
        """
        try:
            return super().update(request, *args, **kwargs)
        except IntegrityError:
            # If the SCIM client attempts to force an update that violates DB unique
            # constraints (e.g. changing the username to one that already exists),
            # return SCIM 409 format.
            return Response(
                {
                    'schemas': ['urn:ietf:params:scim:api:messages:2.0:Error'],
                    'detail': 'One or more attributes in the resource already exists.',
                    'status': '409',
                },
                status=status.HTTP_409_CONFLICT,
            )

    def get_queryset(self):
        # The idp_slug in the URL MUST match the authenticated IdP
        idp = self.request.auth
        if not idp or idp.slug != self.kwargs.get('idp_slug'):
            # Return empty if cross-tenant or missing
            return User.objects.none()

        # Remove the AnonymousUser from SCIM listings
        queryset = super().get_queryset().exclude(id=settings.ANONYMOUS_USER_ID)

        # Only include users that are linked to this IdP's SocialApp.
        if idp.social_app:
            queryset = queryset.filter(
                socialaccount__provider=idp.social_app.provider_id
            )
        else:
            # If the IdP doesn't have a SocialApp, it can't be mapped to any users
            return User.objects.none()

        filter_param = self.request.query_params.get('filter')
        if filter_param:
            # We look for simple expressions like: userName eq "email@example.com"
            # Since the requirement is "Kobo should automatically disable all accounts
            # linked to the same email address", filtering by email is critical.
            match = re.search(
                r'(userName|emails(\.value)?)\s+eq\s+"([^"]+)"', filter_param
            )
            if match:
                field, _, value = match.groups()
                if field == 'userName':
                    queryset = queryset.filter(username__iexact=value)
                elif field.startswith('emails'):
                    queryset = queryset.filter(email__iexact=value)

        return queryset

    def perform_destroy(self, instance):
        # Kobo should automatically disable all accounts linked
        # to the same email address
        email_target = instance.email
        if email_target:
            targets = User.objects.filter(email__iexact=email_target)
        else:
            targets = User.objects.filter(pk=instance.pk)
        users = list(targets.select_related('extra_details'))

        targets.update(is_active=False)

        # Create audit logs as System-initiated events
        idp_slug = self.kwargs.get('idp_slug')
        audit_logs = []

        for user in users:
            metadata = {
                'idp_slug': idp_slug,
                'deactivated_email': email_target,
                'username': user.username,
                'initiated_via': 'SCIM_API',
                'info': 'Automated deactivation via Identity Provider',
            }

            user_uid = getattr(
                getattr(user, 'extra_details', None), 'uid', None
            ) or str(user.id)

            log = AuditLog(
                user=user,
                user_uid=user_uid,
                app_label=user._meta.app_label,
                model_name=user._meta.model_name,
                object_id=user.id,
                action=AuditAction.DEACTIVATION,
                log_type=AuditType.USER_MANAGEMENT,
                metadata=metadata,
            )
            audit_logs.append(log)

        if audit_logs:
            # bulk_create bypasses save(), so we must set user_uid
            # explicitly (done above)
            AuditLog.objects.bulk_create(audit_logs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        operations = normalize_scim_patch_operations(request.data.get('Operations', []))

        active_status = None
        for op in operations:
            if op.get('op', '').lower() == 'replace':
                path = op.get('path')
                value = op.get('value')

                # Case 1: path is 'active', value is directly provided
                if path == 'active' and value is not None:
                    active_status = str(value).lower() == 'true'

                # Case 2: path is omitted, value is an object (or stringified object)
                elif not path and isinstance(value, dict) and 'active' in value:
                    active_status = str(value['active']).lower() == 'true'

        if active_status is not None:
            if active_status is False:
                # Disabling the user
                self.perform_destroy(instance)
            else:
                # Re-enabling the user
                instance.is_active = True
                instance.save(update_fields=['is_active'])

            # SCIM expects the updated resource returned on successful PATCH
            instance.refresh_from_db()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(
            {
                'detail': 'Operation not supported or invalid',
                'received_operations': operations,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


@scim_extend_schema()
@extend_schema_view(
    get=extend_schema(description='Returns the SCIM Service Provider Configuration.'),
)
class ScimServiceProviderConfigView(APIView):
    """
    SCIM 2.0 compliant ServiceProviderConfig endpoint.
    - GET /ServiceProviderConfig
    """

    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer]

    @extend_schema(responses=scim_responses({200: OpenApiTypes.OBJECT}))
    def get(self, request, *args, **kwargs):
        # We only support patch and basic filtering
        payload = {
            'schemas': ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
            'patch': {'supported': True},
            'bulk': {'supported': False},
            'filter': {'supported': True, 'maxResults': 100},
            'changePassword': {'supported': False},
            'sort': {'supported': False},
            'etag': {'supported': False},
            'authenticationSchemes': [
                {
                    'name': 'Bearer Token',
                    'description': 'Authentication via SCIM API Key provided in the Authorization header as a Bearer token.',
                    'specUri': 'https://tools.ietf.org/html/rfc6750',
                    'type': 'oauthbearertoken',
                    'primary': True,
                }
            ],
            'meta': {
                'resourceType': 'ServiceProviderConfig',
                'location': request.build_absolute_uri(),
            },
        }
        return Response(payload, status=status.HTTP_200_OK)


@scim_extend_schema()
@extend_schema_view(
    get=extend_schema(description='Returns the SCIM supported Schemas.'),
)
class ScimSchemasView(APIView):
    """
    SCIM 2.0 compliant Schemas endpoint.
    NOTE: The schemas returned by this view are limited to the fields we handle in
    our current implementation.
    - GET /Schemas
    """

    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer]

    @extend_schema(responses=scim_responses({200: OpenApiTypes.OBJECT}))
    def get(self, request, *args, **kwargs):
        location = request.build_absolute_uri().rstrip('/')
        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            'totalResults': 2,
            'itemsPerPage': 2,
            'startIndex': 1,
            'Resources': [
                {
                    'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
                    'id': 'urn:ietf:params:scim:schemas:core:2.0:User',
                    'name': 'User',
                    'description': 'User Account',
                    'meta': {
                        'resourceType': 'Schema',
                        'location': f'{location}/urn:ietf:params:scim:schemas:core:2.0:User',  #  noqa
                    },
                    'attributes': [
                        {
                            'name': 'userName',
                            'type': 'string',
                            'description': 'Unique identifier for the User',
                            'multiValued': False,
                            'required': True,
                            'caseExact': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                            'uniqueness': 'server',
                        },
                        {
                            'name': 'name',
                            'type': 'complex',
                            'description': "The components of the user's real name.",
                            'multiValued': False,
                            'required': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                            'subAttributes': [
                                {
                                    'name': 'familyName',
                                    'type': 'string',
                                    'description': 'The family name of the User.',
                                    'multiValued': False,
                                    'required': False,
                                    'caseExact': False,
                                    'mutability': 'readWrite',
                                    'returned': 'default',
                                    'uniqueness': 'none',
                                },
                                {
                                    'name': 'givenName',
                                    'type': 'string',
                                    'description': 'The given name of the User.',
                                    'multiValued': False,
                                    'required': False,
                                    'caseExact': False,
                                    'mutability': 'readWrite',
                                    'returned': 'default',
                                    'uniqueness': 'none',
                                },
                            ],
                        },
                        {
                            'name': 'emails',
                            'type': 'complex',
                            'description': 'Email addresses for the user.',
                            'multiValued': True,
                            'required': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                            'subAttributes': [
                                {
                                    'name': 'value',
                                    'type': 'string',
                                    'description': 'Email address.',
                                    'multiValued': False,
                                    'required': False,
                                    'caseExact': False,
                                    'mutability': 'readWrite',
                                    'returned': 'default',
                                    'uniqueness': 'none',
                                },
                                {
                                    'name': 'primary',
                                    'type': 'boolean',
                                    'description': "A boolean value indicating the 'primary' or preferred attribute value for this attribute.",  #  noqa
                                    'multiValued': False,
                                    'required': False,
                                    'mutability': 'readWrite',
                                    'returned': 'default',
                                },
                            ],
                        },
                        {
                            'name': 'active',
                            'type': 'boolean',
                            'description': 'A Boolean value indicating the '
                            "User's administrative status.",
                            'multiValued': False,
                            'required': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                        },
                        {
                            'name': 'externalId',
                            'type': 'string',
                            'description': 'A String that is an identifier for the '
                            'resource as defined by the provisioning client.',
                            'multiValued': False,
                            'required': False,
                            'caseExact': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                            'uniqueness': 'none',
                        },
                    ],
                },
                {
                    'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
                    'id': 'urn:ietf:params:scim:schemas:core:2.0:Group',
                    'name': 'Group',
                    'description': 'Group',
                    'meta': {
                        'resourceType': 'Schema',
                        'location': f'{location}/urn:ietf:params:scim:schemas:core:2.0:Group',  #  noqa
                    },
                    'attributes': [
                        {
                            'name': 'displayName',
                            'type': 'string',
                            'description': 'A human-readable name for the Group.',
                            'multiValued': False,
                            'required': True,
                            'caseExact': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                            'uniqueness': 'none',
                        },
                        {
                            'name': 'members',
                            'type': 'complex',
                            'description': 'A list of members of the Group.',
                            'multiValued': True,
                            'required': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                            'subAttributes': [
                                {
                                    'name': 'value',
                                    'type': 'string',
                                    'description': 'Identifier of the member of this Group.',  #  noqa
                                    'multiValued': False,
                                    'required': False,
                                    'caseExact': False,
                                    'mutability': 'immutable',
                                    'returned': 'default',
                                    'uniqueness': 'none',
                                },
                                {
                                    'name': 'display',
                                    'type': 'string',
                                    'description': 'A human-readable name, primarily used for display purposes.',  #  noqa
                                    'multiValued': False,
                                    'required': False,
                                    'caseExact': False,
                                    'mutability': 'immutable',
                                    'returned': 'default',
                                    'uniqueness': 'none',
                                },
                            ],
                        },
                        {
                            'name': 'externalId',
                            'type': 'string',
                            'description': 'A String that is an identifier for the resource as defined by the provisioning client.',  #  noqa
                            'multiValued': False,
                            'required': False,
                            'caseExact': False,
                            'mutability': 'readWrite',
                            'returned': 'default',
                            'uniqueness': 'none',
                        },
                    ],
                },
            ],
        }
        return Response(payload, status=status.HTTP_200_OK)


@scim_extend_schema()
@extend_schema_view(
    get=extend_schema(description='Returns the SCIM supported ResourceTypes.'),
)
class ScimResourceTypesView(APIView):
    """
    SCIM 2.0 compliant ResourceTypes endpoint.
    - GET /ResourceTypes
    """

    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer]

    @extend_schema(responses=scim_responses({200: OpenApiTypes.OBJECT}))
    def get(self, request, *args, **kwargs):
        location = request.build_absolute_uri().rstrip('/')
        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            'totalResults': 2,
            'itemsPerPage': 2,
            'startIndex': 1,
            'Resources': [
                {
                    'schemas': ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                    'id': 'User',
                    'name': 'User',
                    'endpoint': '/Users',
                    'description': 'User Account',
                    'schema': 'urn:ietf:params:scim:schemas:core:2.0:User',
                    'schemaExtensions': [],
                    'meta': {
                        'resourceType': 'ResourceType',
                        'location': f'{location}/User',
                    },
                },
                {
                    'schemas': ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                    'id': 'Group',
                    'name': 'Group',
                    'endpoint': '/Groups',
                    'description': 'Group',
                    'schema': 'urn:ietf:params:scim:schemas:core:2.0:Group',
                    'schemaExtensions': [],
                    'meta': {
                        'resourceType': 'ResourceType',
                        'location': f'{location}/Group',
                    },
                },
            ],
        }
        return Response(payload, status=status.HTTP_200_OK)


@scim_extend_schema()
@extend_schema_view(
    list=extend_schema(
        description='Returns a list of SCIM groups.',
        responses=scim_responses({200: ScimGroupSerializer(many=True)}),
    ),
    retrieve=extend_schema(
        description='Returns a specific SCIM group.',
        responses=scim_responses({200: ScimGroupSerializer}),
    ),
    create=extend_schema(
        description='Creates a new SCIM group.',
        responses=scim_responses({201: ScimGroupSerializer}),
    ),
    destroy=extend_schema(
        description='Deletes a SCIM group.', responses=scim_responses({204: None})
    ),
    partial_update=extend_schema(
        description='Updates a SCIM group. Supports adding/removing members via '
        'patch operations.',
        responses=scim_responses({200: ScimGroupSerializer}),
    ),
    update=extend_schema(
        description='Replaces a SCIM group entirely.',
        responses=scim_responses({200: ScimGroupSerializer}),
    ),
)
class ScimGroupViewSet(viewsets.ModelViewSet):
    """
    SCIM 2.0 compliant Groups API endpoint.
    - GET /Groups
    - GET /Groups/{group_id}
    - POST /Groups
    - PUT /Groups/{group_id}
    - PATCH /Groups/{group_id}
    - DELETE /Groups/{group_id}
    """

    queryset = ScimGroup.objects.all().order_by('id')
    serializer_class = ScimGroupSerializer
    authentication_classes = [ScimAuthentication]
    permission_classes = [IsAuthenticatedIdP]
    pagination_class = ScimPagination
    parser_classes = [SCIMParser, JSONParser]
    renderer_classes = [SCIMRenderer, JSONRenderer]

    def get_queryset(self):
        idp = self.request.auth
        if not idp or idp.slug != self.kwargs.get('idp_slug'):
            return ScimGroup.objects.none()

        queryset = super().get_queryset().filter(idp=idp)

        filter_param = self.request.query_params.get('filter')
        if filter_param:
            match = re.search(r'displayName\s+eq\s+"([^"]+)"', filter_param)
            if match:
                value = match.group(1)
                queryset = queryset.filter(name__iexact=value)

        return queryset

    def get_users_queryset(self):
        """
        Returns a base QuerySet of users that are valid for the current IdP
        configured by the URL slug and request auth.
        """
        idp = self.request.auth
        if not idp or idp.slug != self.kwargs.get('idp_slug'):
            return User.objects.none()

        if idp.social_app:
            return User.objects.filter(
                socialaccount__provider=idp.social_app.provider_id
            )

        return User.objects.none()

    def perform_create(self, serializer):
        idp = self.request.auth
        display_name = serializer.validated_data.get('name', '')
        external_id = serializer.validated_data.get('scim_external_id', '')

        try:
            group = serializer.save(
                idp=idp, name=display_name, scim_external_id=external_id
            )
        except IntegrityError:
            raise ValidationError(
                {'displayName': ['A group with this name already exists.']}
            )

        members_data = self.request.data.get('members', [])
        self._sync_members(group, members_data)

    def perform_update(self, serializer):
        idp = self.request.auth
        display_name = serializer.validated_data.get('name', '')
        external_id = serializer.validated_data.get('scim_external_id', '')

        try:
            group = serializer.save(
                idp=idp, name=display_name, scim_external_id=external_id
            )
        except IntegrityError:
            raise ValidationError(
                {'displayName': ['A group with this name already exists.']}
            )

        if 'members' in self.request.data:
            members_data = self.request.data.get('members', [])
            self._sync_members(group, members_data, replace=True)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        operations = normalize_scim_patch_operations(request.data.get('Operations', []))

        for op in operations:
            op_type = op.get('op', '').lower()
            path = op.get('path', '')
            value = op.get('value')

            if op_type == 'add':
                if path == 'members':
                    self._add_members(instance, value)
                elif isinstance(value, dict) and 'members' in value:
                    self._add_members(instance, value['members'])

            elif op_type in ('remove', 'delete'):
                if path == 'members':
                    self._remove_members(instance, value)
                # Sometimes path is 'members[value eq "123"]'
                elif path.startswith('members[value eq '):
                    match = re.search(r'members\[value eq "([^"]+)"\]', path)
                    if match:
                        user_id = match.group(1)
                        self._remove_members(instance, [{'value': user_id}])

            elif op_type == 'replace':
                if path == 'displayName' and value:
                    instance.name = value
                    instance.save(update_fields=['name'])
                elif path == 'members':
                    self._sync_members(instance, value, replace=True)

        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _sync_members(self, group, members_data, replace=False):
        if not members_data:
            members_data = []
        elif not isinstance(members_data, list):
            members_data = [members_data]

        base_users_query = self.get_users_queryset()

        users_to_add = set()
        for member_data in members_data:
            user_id = (
                member_data.get('value')
                if isinstance(member_data, dict)
                else member_data
            )
            if user_id:
                try:
                    user = base_users_query.get(id=user_id)
                    users_to_add.add(user)
                except User.DoesNotExist:
                    pass

        if replace:
            group.members.set(users_to_add)
        else:
            group.members.add(*users_to_add)

    def _add_members(self, group, members_data):
        if not members_data:
            return
        if not isinstance(members_data, list):
            members_data = [members_data]

        self._sync_members(group, members_data, replace=False)

    def _remove_members(self, group, members_data):
        if not members_data:
            return
        if not isinstance(members_data, list):
            members_data = [members_data]

        base_users_query = self.get_users_queryset()

        users_to_remove = []
        for member_data in members_data:
            # Depending on path filtering, `value` might just be a string
            # if sent incorrectly, but usually it's dict `{"value": "123"}`
            user_id = (
                member_data.get('value')
                if isinstance(member_data, dict)
                else member_data
            )
            if user_id:
                try:
                    user = base_users_query.get(id=user_id)
                    users_to_remove.append(user)
                except User.DoesNotExist:
                    pass

        if users_to_remove:
            group.members.remove(*users_to_remove)
